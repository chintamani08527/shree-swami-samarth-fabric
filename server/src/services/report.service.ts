import { prisma } from '../db/prisma.js';
import {
  getKolkataDateString,
  getWeekDateRange,
  getMonthDateRange,
  getYearDateRange,
  formatKolkataDate,
  getDayOfWeekName,
} from '../utils/time.js';
import { Roles, AttendanceStatuses } from '../config/index.js';
import { subDays } from 'date-fns';

export async function getDashboardKPIs(targetDateStr?: string) {
  const dateStr = targetDateStr || getKolkataDateString(new Date());

  // 1. Total active workers
  const totalRegisteredWorkers = await prisma.user.count({
    where: {
      role: Roles.WORKER,
      isActive: true,
    },
  });

  // 2. Attendance records today
  const todayRecords = await prisma.attendanceRecord.findMany({
    where: {
      attendanceDate: dateStr,
      user: {
        role: Roles.WORKER,
        isActive: true,
      },
    },
    include: {
      user: {
        include: { department: true },
      },
    },
  });

  const presentToday = todayRecords.filter((r) => r.checkInAt !== null).length;
  const currentlyCheckedIn = todayRecords.filter((r) => r.checkInAt !== null && r.checkOutAt === null).length;
  const lateArrivals = todayRecords.filter((r) => r.lateMinutes > 0).length;
  
  // Calculate total working minutes today (including live elapsed for checked-in workers)
  const now = new Date();
  let totalMinutesToday = 0;
  todayRecords.forEach((r) => {
    if (r.checkOutAt) {
      totalMinutesToday += r.workingMinutes;
    } else if (r.checkInAt) {
      const elapsed = Math.round((now.getTime() - r.checkInAt.getTime()) / (60 * 1000));
      totalMinutesToday += Math.max(0, elapsed);
    }
  });

  const totalWorkingHoursToday = Number((totalMinutesToday / 60).toFixed(1));
  const absentToday = Math.max(0, totalRegisteredWorkers - presentToday);

  // 3. Last 7 days attendance trend
  const trendDays: {
    date: string;
    formattedDate: string;
    day: string;
    present: number;
    late: number;
    absent: number;
    hours: number;
  }[] = [];

  const baseDate = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = subDays(baseDate, i);
    const dStr = getKolkataDateString(d);
    
    // In production this could be cached or grouped, here we fetch cleanly
    const dayRecords = await prisma.attendanceRecord.findMany({
      where: {
        attendanceDate: dStr,
        user: { role: Roles.WORKER, isActive: true },
      },
    });

    const dayPresent = dayRecords.filter((r) => r.checkInAt !== null).length;
    const dayLate = dayRecords.filter((r) => r.lateMinutes > 0).length;
    const dayMinutes = dayRecords.reduce((acc, curr) => acc + (curr.workingMinutes || 0), 0);

    trendDays.push({
      date: dStr,
      formattedDate: formatKolkataDate(dStr),
      day: getDayOfWeekName(dStr).substring(0, 3), // Mon, Tue...
      present: dayPresent,
      late: dayLate,
      absent: Math.max(0, totalRegisteredWorkers - dayPresent),
      hours: Number((dayMinutes / 60).toFixed(1)),
    });
  }

  // 4. Department-wise breakdown
  const departments = await prisma.department.findMany({
    where: { isActive: true },
    include: {
      users: {
        where: { role: Roles.WORKER, isActive: true },
        select: { id: true },
      },
    },
  });

  const departmentBreakdown = departments.map((dept) => {
    const deptUserIds = new Set(dept.users.map((u) => u.id));
    const deptTodayRecords = todayRecords.filter((r) => deptUserIds.has(r.userId));

    const present = deptTodayRecords.filter((r) => r.checkInAt !== null).length;
    const checkedInNow = deptTodayRecords.filter((r) => r.checkInAt !== null && r.checkOutAt === null).length;
    const totalDeptWorkers = dept.users.length;
    const rate = totalDeptWorkers > 0 ? Math.round((present / totalDeptWorkers) * 100) : 0;

    return {
      id: dept.id,
      name: dept.name,
      totalWorkers: totalDeptWorkers,
      present,
      checkedInNow,
      absent: Math.max(0, totalDeptWorkers - present),
      attendanceRate: rate,
    };
  });

  return {
    kpis: {
      totalRegisteredWorkers,
      presentToday,
      absentToday,
      currentlyCheckedIn,
      lateArrivals,
      totalWorkingHoursToday,
      attendancePercentage: totalRegisteredWorkers > 0 ? Math.round((presentToday / totalRegisteredWorkers) * 100) : 0,
      targetDate: dateStr,
      formattedTargetDate: formatKolkataDate(dateStr),
    },
    trend: trendDays,
    departmentBreakdown,
  };
}

export async function getWeeklyAttendanceReport(refDateStr?: string, departmentId?: string) {
  const week = getWeekDateRange(refDateStr);

  const whereWorker: any = {
    role: Roles.WORKER,
    isActive: true,
  };

  if (departmentId) {
    whereWorker.departmentId = departmentId;
  }

  const workers = await prisma.user.findMany({
    where: whereWorker,
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
      attendanceRecords: {
        where: {
          attendanceDate: {
            in: week.dates,
          },
        },
      },
    },
    orderBy: { workerId: 'asc' },
  });

  const workerSummaries = workers.map((w) => {
    const recordByDate = new Map<string, any>();
    w.attendanceRecords.forEach((r) => recordByDate.set(r.attendanceDate, r));

    let totalMinutes = 0;
    let daysPresent = 0;
    let daysLate = 0;
    let totalOvertimeMinutes = 0;
    let totalBreakMinutes = 0;

    const dailyBreakdown = week.dates.map((dateStr) => {
      const rec = recordByDate.get(dateStr);
      if (rec && rec.checkInAt) {
        daysPresent += 1;
        totalMinutes += rec.workingMinutes;
        totalOvertimeMinutes += rec.overtimeMinutes;
        totalBreakMinutes += rec.breakMinutes;
        if (rec.lateMinutes > 0) daysLate += 1;

        return {
          date: dateStr,
          status: rec.status,
          workingHours: Number((rec.workingMinutes / 60).toFixed(2)),
          lateMinutes: rec.lateMinutes,
          isMissingCheckOut: rec.isMissingCheckOut,
        };
      }
      return {
        date: dateStr,
        status: 'ABSENT',
        workingHours: 0,
        lateMinutes: 0,
        isMissingCheckOut: false,
      };
    });

    return {
      userId: w.id,
      workerId: w.workerId,
      name: w.name,
      phone: w.phone,
      department: w.department?.name || 'Unassigned',
      shift: w.workerShifts[0]?.shift?.name || 'General Shift',
      daysPresent,
      daysLate,
      daysAbsent: 7 - daysPresent,
      totalWorkingHours: Number((totalMinutes / 60).toFixed(2)),
      totalOvertimeHours: Number((totalOvertimeMinutes / 60).toFixed(2)),
      totalBreakMinutes,
      dailyBreakdown,
    };
  });

  // Calculate department and company overall totals
  const totalPossibleDays = workers.length * 7;
  const totalDaysPresentAll = workerSummaries.reduce((sum, w) => sum + w.daysPresent, 0);
  const totalHoursAll = workerSummaries.reduce((sum, w) => sum + w.totalWorkingHours, 0);
  const totalOvertimeAll = workerSummaries.reduce((sum, w) => sum + w.totalOvertimeHours, 0);

  return {
    period: {
      startDate: week.startOfWeek,
      endDate: week.endOfWeek,
      formattedStart: formatKolkataDate(week.startOfWeek),
      formattedEnd: formatKolkataDate(week.endOfWeek),
      dates: week.dates,
    },
    overall: {
      totalWorkers: workers.length,
      totalHours: Number(totalHoursAll.toFixed(2)),
      totalOvertimeHours: Number(totalOvertimeAll.toFixed(2)),
      overallAttendanceRate: totalPossibleDays > 0 ? Math.round((totalDaysPresentAll / totalPossibleDays) * 100) : 0,
    },
    workers: workerSummaries,
  };
}

export async function getMonthlyAttendanceReport(refDateStr?: string, departmentId?: string) {
  const month = getMonthDateRange(refDateStr);

  const whereWorker: any = {
    role: Roles.WORKER,
    isActive: true,
  };

  if (departmentId) {
    whereWorker.departmentId = departmentId;
  }

  const workers = await prisma.user.findMany({
    where: whereWorker,
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
      attendanceRecords: {
        where: {
          attendanceDate: {
            gte: month.startOfMonth,
            lte: month.endOfMonth,
          },
        },
      },
    },
    orderBy: { workerId: 'asc' },
  });

  const workerSummaries = workers.map((w) => {
    let totalWorkingHoursAll = 0;
    let daysPresent = 0;
    let daysLate = 0;
    let totalOvertimeMinutes = 0;
    let totalBreakMinutes = 0;
    let totalMinutes = 0;
    let totalMachinesOperated = 0;
    let totalCustomHoursOperated = 0;

    w.attendanceRecords.forEach((r) => {
      if (r.checkInAt) {
        daysPresent += 1;
        totalMinutes += r.workingMinutes;
        totalOvertimeMinutes += r.overtimeMinutes;
        totalBreakMinutes += r.breakMinutes;
        if (r.lateMinutes > 0) daysLate += 1;
        if (r.machinesOperated) totalMachinesOperated += r.machinesOperated;
        if (r.hoursOperated) totalCustomHoursOperated += r.hoursOperated;
      }
    });

    const totalWorkingHours = Number((totalMinutes / 60).toFixed(2));
    const totalOvertimeHours = Number((totalOvertimeMinutes / 60).toFixed(2));
    const isCustom = w.wageType === 'CUSTOM';
    const dailyWage = isCustom ? 0 : (w.dailyWage || 0);
    const estimatedPayout = isCustom ? 0 : Math.round(daysPresent * dailyWage);

    return {
      userId: w.id,
      workerId: w.workerId,
      name: w.name,
      phone: w.phone,
      department: w.department?.name || 'Unassigned',
      shift: w.workerShifts[0]?.shift?.name || 'General Shift',
      wageType: w.wageType || 'FIXED',
      hasCustomWageAccess: Boolean(w.hasCustomWageAccess),
      dailyWage: isCustom ? null : w.dailyWage,
      machinesOperated: totalMachinesOperated > 0 ? totalMachinesOperated : null,
      hoursOperated: totalCustomHoursOperated > 0 ? Number(totalCustomHoursOperated.toFixed(1)) : null,
      daysInMonth: month.totalDays,
      daysPresent,
      daysLate,
      daysAbsent: Math.max(0, month.totalDays - daysPresent),
      totalWorkingHours,
      totalOvertimeHours,
      totalBreakMinutes,
      estimatedPayout,
    };
  });

  const totalDaysPresentAll = workerSummaries.reduce((sum, w) => sum + w.daysPresent, 0);
  const totalHoursAll = workerSummaries.reduce((sum, w) => sum + w.totalWorkingHours, 0);
  const totalOvertimeAll = workerSummaries.reduce((sum, w) => sum + w.totalOvertimeHours, 0);
  const totalPayoutAll = workerSummaries.reduce((sum, w) => sum + w.estimatedPayout, 0);
  const totalPossibleDays = workers.length * month.totalDays;

  return {
    period: {
      type: 'MONTHLY',
      startDate: month.startOfMonth,
      endDate: month.endOfMonth,
      formattedStart: formatKolkataDate(month.startOfMonth),
      formattedEnd: formatKolkataDate(month.endOfMonth),
      monthName: month.monthName,
      totalDays: month.totalDays,
    },
    overall: {
      totalWorkers: workers.length,
      totalHours: Number(totalHoursAll.toFixed(2)),
      totalOvertimeHours: Number(totalOvertimeAll.toFixed(2)),
      totalPayout: totalPayoutAll,
      overallAttendanceRate: totalPossibleDays > 0 ? Math.round((totalDaysPresentAll / totalPossibleDays) * 100) : 0,
    },
    workers: workerSummaries,
  };
}

export async function getYearlyAttendanceReport(yearRef?: number | string, departmentId?: string) {
  const yearInfo = getYearDateRange(yearRef);

  const whereWorker: any = {
    role: Roles.WORKER,
    isActive: true,
  };

  if (departmentId) {
    whereWorker.departmentId = departmentId;
  }

  const workers = await prisma.user.findMany({
    where: whereWorker,
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
      attendanceRecords: {
        where: {
          attendanceDate: {
            gte: yearInfo.startOfYear,
            lte: yearInfo.endOfYear,
          },
        },
      },
    },
    orderBy: { workerId: 'asc' },
  });

  const workerSummaries = workers.map((w) => {
    let totalMinutes = 0;
    let daysPresent = 0;
    let daysLate = 0;
    let totalOvertimeMinutes = 0;
    let totalBreakMinutes = 0;

    const monthlyCounts = Array.from({ length: 12 }, () => 0);

    w.attendanceRecords.forEach((r) => {
      if (r.checkInAt) {
        daysPresent += 1;
        totalMinutes += r.workingMinutes;
        totalOvertimeMinutes += r.overtimeMinutes;
        totalBreakMinutes += r.breakMinutes;
        if (r.lateMinutes > 0) daysLate += 1;

        const m = parseInt(r.attendanceDate.split('-')[1], 10) - 1;
        if (m >= 0 && m < 12) {
          monthlyCounts[m] += 1;
        }
      }
    });

    const totalWorkingHours = Number((totalMinutes / 60).toFixed(2));
    const totalOvertimeHours = Number((totalOvertimeMinutes / 60).toFixed(2));
    const dailyWage = w.dailyWage || 0;
    const estimatedPayout = Math.round(daysPresent * dailyWage);

    return {
      userId: w.id,
      workerId: w.workerId,
      name: w.name,
      phone: w.phone,
      department: w.department?.name || 'Unassigned',
      shift: w.workerShifts[0]?.shift?.name || 'General Shift',
      dailyWage: w.dailyWage,
      daysPresent,
      daysLate,
      totalWorkingHours,
      totalOvertimeHours,
      totalBreakMinutes,
      estimatedPayout,
      monthlyCounts,
    };
  });

  const totalDaysPresentAll = workerSummaries.reduce((sum, w) => sum + w.daysPresent, 0);
  const totalHoursAll = workerSummaries.reduce((sum, w) => sum + w.totalWorkingHours, 0);
  const totalOvertimeAll = workerSummaries.reduce((sum, w) => sum + w.totalOvertimeHours, 0);
  const totalPayoutAll = workerSummaries.reduce((sum, w) => sum + w.estimatedPayout, 0);

  return {
    period: {
      type: 'YEARLY',
      year: yearInfo.year,
      startDate: yearInfo.startOfYear,
      endDate: yearInfo.endOfYear,
      formattedStart: formatKolkataDate(yearInfo.startOfYear),
      formattedEnd: formatKolkataDate(yearInfo.endOfYear),
    },
    overall: {
      totalWorkers: workers.length,
      totalHours: Number(totalHoursAll.toFixed(2)),
      totalOvertimeHours: Number(totalOvertimeAll.toFixed(2)),
      totalPayout: totalPayoutAll,
      totalDaysPresent: totalDaysPresentAll,
    },
    workers: workerSummaries,
  };
}
