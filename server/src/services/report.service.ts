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

  // 1. Prepare 7 days dates for trend
  const baseDate = new Date();
  const dateList: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dateList.push(getKolkataDateString(subDays(baseDate, i)));
  }

  // 2. Fetch all initial dashboard data in parallel
  const [allWorkers, todayRecords, all7DaysRecords, departments] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: Roles.WORKER,
        isActive: true,
      },
      select: {
        id: true,
        workerId: true,
        name: true,
        phone: true,
        unit: true,
        wageType: true,
        dailyWage: true,
        customWageRate: true,
        hasCustomWageAccess: true,
        department: { select: { id: true, name: true } },
        workerShifts: {
          where: { effectiveTo: null },
          include: { shift: true },
          take: 1,
        },
      },
      orderBy: { workerId: 'asc' },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        OR: [
          { attendanceDate: dateStr },
          {
            attendanceDate: getKolkataDateString(subDays(baseDate, 1)),
            checkInAt: { not: null },
            checkOutAt: null,
          },
        ],
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
    }),
    prisma.attendanceRecord.findMany({
      where: {
        attendanceDate: { in: dateList },
        user: { role: Roles.WORKER, isActive: true },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      include: {
        users: {
          where: { role: Roles.WORKER, isActive: true },
          select: { id: true },
        },
      },
    }),
  ]);

  const totalRegisteredWorkers = allWorkers.length;

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

  // Group 7-day records by attendanceDate in memory (0 DB overhead)
  const recordsByDate = new Map<string, any[]>();
  all7DaysRecords.forEach((r) => {
    const list = recordsByDate.get(r.attendanceDate) || [];
    list.push(r);
    recordsByDate.set(r.attendanceDate, list);
  });

  const trendDays: {
    date: string;
    formattedDate: string;
    day: string;
    present: number;
    late: number;
    absent: number;
    hours: number;
  }[] = [];

  for (const dStr of dateList) {
    const dayRecords = recordsByDate.get(dStr) || [];
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

  // Department-wise breakdown
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

  // Categorize worker lists for interactive dashboard drilldown
  const todayRecordByUser = new Map<string, any>();
  todayRecords.forEach((r) => todayRecordByUser.set(r.userId, r));

  const formatTime = (date?: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  };

  const registeredWorkerItems = allWorkers.map((w) => {
    const rec = todayRecordByUser.get(w.id);
    const isPresent = Boolean(rec && rec.checkInAt !== null);
    const isOnFloor = Boolean(isPresent && rec.checkOutAt === null);

    let status: 'PRESENT' | 'ABSENT' | 'ON_FLOOR' = 'ABSENT';
    if (isOnFloor) status = 'ON_FLOOR';
    else if (isPresent) status = 'PRESENT';

    return {
      id: w.id,
      workerId: w.workerId,
      name: w.name,
      phone: w.phone || null,
      unit: w.unit || 'Unit 1',
      department: w.department?.name || 'Unassigned',
      shift: w.workerShifts[0]?.shift?.name || 'General Shift',
      wageType: w.wageType || 'FIXED',
      dailyWage: w.dailyWage || null,
      customWageRate: w.customWageRate || null,
      status,
      checkInTime: formatTime(rec?.checkInAt),
      checkOutTime: formatTime(rec?.checkOutAt),
      lateMinutes: rec?.lateMinutes || 0,
      workingMinutes: rec?.workingMinutes || 0,
      machinesOperated: rec?.machinesOperated ?? null,
      hoursOperated: rec?.hoursOperated ?? null,
    };
  });

  const presentWorkerItems = registeredWorkerItems.filter((w) => w.status === 'PRESENT' || w.status === 'ON_FLOOR');
  const absentWorkerItems = registeredWorkerItems.filter((w) => w.status === 'ABSENT');
  const onFloorWorkerItems = registeredWorkerItems.filter((w) => w.status === 'ON_FLOOR');
  const lateWorkerItems = registeredWorkerItems.filter((w) => (w.lateMinutes || 0) > 0);

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
    workerLists: {
      registered: registeredWorkerItems,
      present: presentWorkerItems,
      absent: absentWorkerItems,
      onFloor: onFloorWorkerItems,
      late: lateWorkerItems,
    },
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
    let totalMachinesOperated = 0;
    let totalCustomHoursOperated = 0;

    const dailyBreakdown = week.dates.map((dateStr) => {
      const rec = recordByDate.get(dateStr);
      if (rec && rec.checkInAt) {
        daysPresent += 1;
        totalMinutes += rec.workingMinutes;
        if (rec.overtimeStatus === 'APPROVED') {
          totalOvertimeMinutes += (rec.overtimeMinutes || (rec.overtimeHours ? Math.round(rec.overtimeHours * 60) : 0));
        }
        totalBreakMinutes += rec.breakMinutes;
        if (rec.lateMinutes > 0) daysLate += 1;
        if (rec.machinesOperated) totalMachinesOperated += rec.machinesOperated;
        if (rec.hoursOperated) totalCustomHoursOperated += rec.hoursOperated;

        return {
          date: dateStr,
          status: rec.status,
          workingHours: Number((rec.workingMinutes / 60).toFixed(2)),
          lateMinutes: rec.lateMinutes,
          isMissingCheckOut: rec.isMissingCheckOut,
          machinesOperated: rec.machinesOperated ?? null,
          hoursOperated: rec.hoursOperated ?? null,
        };
      }
      return {
        date: dateStr,
        status: 'ABSENT',
        workingHours: 0,
        lateMinutes: 0,
        isMissingCheckOut: false,
        machinesOperated: null,
        hoursOperated: null,
      };
    });

    const totalWorkingHours = Number((totalMinutes / 60).toFixed(2));
    const totalOvertimeHours = Number((totalOvertimeMinutes / 60).toFixed(2));
    const isCustom = w.wageType === 'CUSTOM';
    const customRate = w.customWageRate || 0;
    const dailyWage = isCustom ? 0 : (w.dailyWage || 0);

    let customEarnings = 0;
    if (isCustom && customRate > 0) {
      customEarnings = w.attendanceRecords.reduce((sum: number, r: any) => {
        const m = r.machinesOperated ?? (r.workingMinutes > 0 ? 1 : 0);
        const h = r.hoursOperated ?? (r.workingMinutes / 60);
        const isApproved = r.overtimeStatus === 'APPROVED';
        const otM = r.overtimeMachines ?? 0;
        const otH = r.overtimeHours ?? (r.overtimeMinutes ? r.overtimeMinutes / 60 : 0);
        const shiftPay = m * h * customRate;
        const otPay = isApproved
          ? (otM > 0 && otH > 0 ? otM * otH * customRate : otH * (customRate * (m || 1)))
          : 0;
        return sum + shiftPay + otPay;
      }, 0);
    }

    const estimatedPayout = isCustom
      ? Math.round(customEarnings)
      : Math.round(daysPresent * dailyWage + (totalOvertimeHours * (dailyWage / 12)));

    const operatedDays = w.attendanceRecords.filter((r: any) => (r.machinesOperated || 0) > 0);
    const avgMachines = operatedDays.length > 0
      ? Math.round(operatedDays.reduce((s: number, r: any) => s + (r.machinesOperated || 0), 0) / operatedDays.length)
      : (isCustom ? 2 : (totalMachinesOperated > 0 ? totalMachinesOperated : 0));

    return {
      userId: w.id,
      workerId: w.workerId,
      name: w.name,
      unit: w.unit || 'Unit 1',
      phone: w.phone,
      department: w.department?.name || 'Unassigned',
      shift: w.workerShifts[0]?.shift?.name || 'General Shift',
      wageType: w.wageType || 'FIXED',
      hasCustomWageAccess: Boolean(w.hasCustomWageAccess),
      dailyWage: isCustom ? null : w.dailyWage,
      customWageRate: isCustom ? w.customWageRate : null,
      machinesOperated: avgMachines > 0 ? avgMachines : null,
      totalMachinesLogged: totalMachinesOperated,
      daysPresent,
      daysLate,
      daysAbsent: 7 - daysPresent,
      totalWorkingHours,
      totalOvertimeHours,
      totalBreakMinutes,
      estimatedPayout,
      dailyBreakdown,
    };
  });

  // Calculate department and company overall totals
  const totalPossibleDays = workers.length * 7;
  const totalDaysPresentAll = workerSummaries.reduce((sum, w) => sum + w.daysPresent, 0);
  const totalHoursAll = workerSummaries.reduce((sum, w) => sum + w.totalWorkingHours, 0);
  const totalOvertimeAll = workerSummaries.reduce((sum, w) => sum + w.totalOvertimeHours, 0);
  const totalPayoutAll = workerSummaries.reduce((sum, w) => sum + w.estimatedPayout, 0);

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
      totalPayout: totalPayoutAll,
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
        if (r.overtimeStatus === 'APPROVED') {
          totalOvertimeMinutes += (r.overtimeMinutes || (r.overtimeHours ? Math.round(r.overtimeHours * 60) : 0));
        }
        totalBreakMinutes += r.breakMinutes;
        if (r.lateMinutes > 0) daysLate += 1;
        if (r.machinesOperated) totalMachinesOperated += r.machinesOperated;
        if (r.hoursOperated) totalCustomHoursOperated += r.hoursOperated;
      }
    });

    const totalWorkingHours = Number((totalMinutes / 60).toFixed(2));
    const totalOvertimeHours = Number((totalOvertimeMinutes / 60).toFixed(2));
    const isCustom = w.wageType === 'CUSTOM';
    const customRate = w.customWageRate || 0;
    const dailyWage = isCustom ? 0 : (w.dailyWage || 0);

    let customEarnings = 0;
    if (isCustom && customRate > 0) {
      customEarnings = w.attendanceRecords.reduce((sum: number, r: any) => {
        const m = r.machinesOperated ?? (r.workingMinutes > 0 ? 1 : 0);
        const h = r.hoursOperated ?? (r.workingMinutes / 60);
        const isApproved = r.overtimeStatus === 'APPROVED';
        const otM = r.overtimeMachines ?? 0;
        const otH = r.overtimeHours ?? (r.overtimeMinutes ? r.overtimeMinutes / 60 : 0);
        const shiftPay = m * h * customRate;
        const otPay = isApproved
          ? (otM > 0 && otH > 0 ? otM * otH * customRate : otH * (customRate * (m || 1)))
          : 0;
        return sum + shiftPay + otPay;
      }, 0);
    }

    const estimatedPayout = isCustom
      ? Math.round(customEarnings)
      : Math.round(daysPresent * dailyWage + (totalOvertimeHours * (dailyWage / 12)));

    return {
      userId: w.id,
      workerId: w.workerId,
      name: w.name,
      unit: w.unit || 'Unit 1',
      phone: w.phone,
      department: w.department?.name || 'Unassigned',
      shift: w.workerShifts[0]?.shift?.name || 'General Shift',
      wageType: w.wageType || 'FIXED',
      hasCustomWageAccess: Boolean(w.hasCustomWageAccess),
      dailyWage: isCustom ? null : w.dailyWage,
      customWageRate: isCustom ? w.customWageRate : null,
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
    let totalMachinesOperated = 0;
    let totalCustomHoursOperated = 0;

    const monthlyCounts = Array.from({ length: 12 }, () => 0);

    w.attendanceRecords.forEach((r) => {
      if (r.checkInAt) {
        daysPresent += 1;
        totalMinutes += r.workingMinutes;
        if (r.overtimeStatus === 'APPROVED') {
          totalOvertimeMinutes += (r.overtimeMinutes || 0);
        }
        totalBreakMinutes += r.breakMinutes;
        if (r.lateMinutes > 0) daysLate += 1;
        if (r.machinesOperated) totalMachinesOperated += r.machinesOperated;
        if (r.hoursOperated) totalCustomHoursOperated += r.hoursOperated;

        const m = parseInt(r.attendanceDate.split('-')[1], 10) - 1;
        if (m >= 0 && m < 12) {
          monthlyCounts[m] += 1;
        }
      }
    });

    const totalWorkingHours = Number((totalMinutes / 60).toFixed(2));
    const totalOvertimeHours = Number((totalOvertimeMinutes / 60).toFixed(2));
    const isCustom = w.wageType === 'CUSTOM';
    const customRate = w.customWageRate || 0;
    const dailyWage = isCustom ? 0 : (w.dailyWage || 0);

    let customEarnings = 0;
    if (isCustom && customRate > 0) {
      customEarnings = w.attendanceRecords.reduce((sum: number, r: any) => {
        const m = r.machinesOperated ?? (r.workingMinutes > 0 ? 1 : 0);
        const h = r.hoursOperated ?? (r.workingMinutes / 60);
        const isApproved = r.overtimeStatus === 'APPROVED';
        const otM = r.overtimeMachines ?? 0;
        const otH = r.overtimeHours ?? (r.overtimeMinutes ? r.overtimeMinutes / 60 : 0);
        const shiftPay = m * h * customRate;
        const otPay = isApproved
          ? (otM > 0 && otH > 0 ? otM * otH * customRate : otH * (customRate * (m || 1)))
          : 0;
        return sum + shiftPay + otPay;
      }, 0);
    }
    const estimatedPayout = isCustom
      ? Math.round(customEarnings)
      : Math.round(daysPresent * dailyWage + (totalOvertimeHours * (dailyWage / 12)));

    return {
      userId: w.id,
      workerId: w.workerId,
      name: w.name,
      unit: w.unit || 'Unit 1',
      phone: w.phone,
      department: w.department?.name || 'Unassigned',
      shift: w.workerShifts[0]?.shift?.name || 'General Shift',
      wageType: w.wageType || 'FIXED',
      hasCustomWageAccess: Boolean(w.hasCustomWageAccess),
      dailyWage: isCustom ? null : w.dailyWage,
      customWageRate: isCustom ? w.customWageRate : null,
      machinesOperated: totalMachinesOperated > 0 ? totalMachinesOperated : null,
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
