import { prisma } from '../db/prisma.js';
import {
  getKolkataDateString,
  calculateWorkingHoursAndStatus,
  formatKolkataTime,
  getWeekDateRange,
  formatKolkataDate,
  getDayOfWeekName,
  parseKolkataTimeString,
} from '../utils/time.js';
import {
  AttendanceStatuses,
  AttendanceSources,
  AttendanceSourceType,
  AttendanceStatusType,
  DEFAULT_ATTENDANCE_RULES,
} from '../config/index.js';
import { logAudit } from '../middleware/audit.js';

/**
 * Worker check-in action
 */
export async function processCheckIn(
  userId: string,
  source: AttendanceSourceType = AttendanceSources.WEB_MOBILE,
  adminActor?: { id: string; name: string }
) {
  const serverNow = new Date(); // Server-authoritative timestamp
  const attendanceDate = getKolkataDateString(serverNow);

  // Fetch worker and active shift
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) {
    throw new Error('Worker profile not found or inactive.');
  }

  // Check for existing record today
  const existingRecord = await prisma.attendanceRecord.findUnique({
    where: {
      userId_attendanceDate: {
        userId,
        attendanceDate,
      },
    },
  });

  if (existingRecord && existingRecord.checkInAt) {
    throw new Error(
      `Attendance already recorded: Checked in at ${formatKolkataTime(existingRecord.checkInAt)} today.`
    );
  }

  // Find shift (or default)
  const shift = user.workerShifts[0]?.shift || await prisma.shift.findFirst({ where: { isActive: true } });

  // Validate 30-minute check-in band time:
  // Workers can only check in within 30 minutes before or after scheduled shift start.
  // Admin / Owner overrides bypass this check.
  if (shift && !adminActor) {
    let bandMinutes = 30;
    try {
      const companySettings = await prisma.companySettings.findUnique({ where: { id: 'default-settings' } });
      if (companySettings?.attendanceRules) {
        const parsed = JSON.parse(companySettings.attendanceRules);
        if (parsed.checkInBandMinutes !== undefined) {
          bandMinutes = Number(parsed.checkInBandMinutes);
        }
      }
    } catch {}

    const expectedStart = parseKolkataTimeString(shift.startTime, attendanceDate);
    let windowStart = new Date(expectedStart.getTime() - bandMinutes * 60 * 1000);
    let windowEnd = new Date(expectedStart.getTime() + bandMinutes * 60 * 1000);

    const nowMs = serverNow.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Handle shift boundary alignment (e.g. overnight shifts)
    if (Math.abs(nowMs - (expectedStart.getTime() - dayMs)) < Math.abs(nowMs - expectedStart.getTime())) {
      windowStart = new Date(windowStart.getTime() - dayMs);
      windowEnd = new Date(windowEnd.getTime() - dayMs);
    } else if (Math.abs(nowMs - (expectedStart.getTime() + dayMs)) < Math.abs(nowMs - expectedStart.getTime())) {
      windowStart = new Date(windowStart.getTime() + dayMs);
      windowEnd = new Date(windowEnd.getTime() + dayMs);
    }

    if (nowMs < windowStart.getTime()) {
      const diffMins = Math.ceil((windowStart.getTime() - nowMs) / (60 * 1000));
      throw new Error(
        `Check-in window not open yet. Shift starts at ${formatKolkataTime(expectedStart)}. You can check in from ${formatKolkataTime(windowStart)} to ${formatKolkataTime(windowEnd)} (30 minutes band time). Opens in ${diffMins} min(s).`
      );
    }

    if (nowMs > windowEnd.getTime()) {
      throw new Error(
        `Check-in window closed. Shift check-in was allowed until ${formatKolkataTime(windowEnd)} (30 minutes after shift start). Please contact Owner or Supervisor.`
      );
    }
  }

  // Calculate late minutes
  const calc = calculateWorkingHoursAndStatus(serverNow, null, shift, attendanceDate);

  const record = existingRecord
    ? await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          checkInAt: serverNow,
          status: calc.status,
          lateMinutes: calc.lateMinutes,
          source,
          isMissingCheckOut: false,
        },
      })
    : await prisma.attendanceRecord.create({
        data: {
          userId,
          workerId: user.workerId,
          attendanceDate,
          checkInAt: serverNow,
          status: calc.status,
          lateMinutes: calc.lateMinutes,
          source,
          isMissingCheckOut: false,
        },
      });

  if (adminActor) {
    await logAudit({
      actorUserId: adminActor.id,
      actorName: adminActor.name,
      action: 'ADMIN_CHECK_IN',
      entityType: 'ATTENDANCE',
      entityId: record.id,
      reason: 'Admin marked check-in on behalf of worker',
      details: { workerId: user.workerId, attendanceDate, checkInAt: serverNow },
    });
  }

  return {
    record,
    worker: {
      id: user.id,
      workerId: user.workerId,
      name: user.name,
    },
    message: `Namaste ${user.name}! Check-in recorded at ${formatKolkataTime(serverNow)}.`,
  };
}

/**
 * Worker check-out action
 */
export async function processCheckOut(
  userId: string,
  source: AttendanceSourceType = AttendanceSources.WEB_MOBILE,
  adminActor?: { id: string; name: string }
) {
  const serverNow = new Date(); // Server-authoritative timestamp
  const attendanceDate = getKolkataDateString(serverNow);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) {
    throw new Error('Worker profile not found or inactive.');
  }

  // Find today's open attendance record
  let record = await prisma.attendanceRecord.findUnique({
    where: {
      userId_attendanceDate: {
        userId,
        attendanceDate,
      },
    },
  });

  // If no record found for today's date, check if there is an open overnight record from yesterday
  if (!record || !record.checkInAt) {
    const yesterday = new Date(serverNow.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDate = getKolkataDateString(yesterday);
    const openYesterdayRecord = await prisma.attendanceRecord.findUnique({
      where: {
        userId_attendanceDate: {
          userId,
          attendanceDate: yesterdayDate,
        },
      },
    });

    if (openYesterdayRecord && openYesterdayRecord.checkInAt && !openYesterdayRecord.checkOutAt) {
      record = openYesterdayRecord;
    } else {
      throw new Error('No active check-in found for today. Please tap Check In when you arrive at the factory.');
    }
  }

  if (record.checkOutAt) {
    throw new Error(
      `Check-out already completed at ${formatKolkataTime(record.checkOutAt)} today. Have a restful evening!`
    );
  }

  const shift = user.workerShifts[0]?.shift || await prisma.shift.findFirst({ where: { isActive: true } });

  // Calculate full metrics
  const calc = calculateWorkingHoursAndStatus(
    record.checkInAt!,
    serverNow,
    shift,
    record.attendanceDate
  );

  const updatedRecord = await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      checkOutAt: serverNow,
      workingMinutes: calc.workingMinutes,
      breakMinutes: calc.breakMinutes,
      overtimeMinutes: calc.overtimeMinutes,
      lateMinutes: calc.lateMinutes,
      status: calc.status,
      isMissingCheckOut: false,
    },
  });

  if (adminActor) {
    await logAudit({
      actorUserId: adminActor.id,
      actorName: adminActor.name,
      action: 'ADMIN_CHECK_OUT',
      entityType: 'ATTENDANCE',
      entityId: updatedRecord.id,
      reason: 'Admin marked check-out on behalf of worker',
      details: { workerId: user.workerId, checkOutAt: serverNow, workingMinutes: calc.workingMinutes },
    });
  }

  return {
    record: updatedRecord,
    workingHours: calc.workingHours,
    breakMinutes: calc.breakMinutes,
    overtimeMinutes: calc.overtimeMinutes,
    message: `Thank you, ${user.name}! Check-out recorded at ${formatKolkataTime(serverNow)}. Total working hours: ${calc.workingHours} hrs.`,
  };
}

/**
 * Get Worker's current status and personal summary
 */
export async function getWorkerStatus(userId: string) {
  const todayDate = getKolkataDateString(new Date());

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      workerShifts: {
        where: { effectiveTo: null },
        include: { shift: true },
        take: 1,
      },
    },
  });

  if (!user) throw new Error('Worker not found');

  const shift = user.workerShifts[0]?.shift || await prisma.shift.findFirst({ where: { isActive: true } });

  const todayRecord = await prisma.attendanceRecord.findUnique({
    where: {
      userId_attendanceDate: {
        userId,
        attendanceDate: todayDate,
      },
    },
  });

  // Calculate live working duration if checked in and not checked out
  let liveDurationMinutes = 0;
  let isCheckedIn = false;
  let isCheckedOut = false;

  if (todayRecord?.checkInAt) {
    isCheckedIn = true;
    if (todayRecord.checkOutAt) {
      isCheckedOut = true;
      liveDurationMinutes = todayRecord.workingMinutes;
    } else {
      const now = new Date();
      const rawElapsed = Math.round((now.getTime() - todayRecord.checkInAt.getTime()) / (60 * 1000));
      // Deduct break if applicable
      const breakDed = rawElapsed >= (DEFAULT_ATTENDANCE_RULES.autoDeductBreakThresholdMinutes)
        ? (shift?.breakDurationMinutes || 60)
        : 0;
      liveDurationMinutes = Math.max(0, rawElapsed - breakDed);
    }
  }

  // Weekly summary
  const weekInfo = getWeekDateRange(todayDate);
  const weeklyRecords = await prisma.attendanceRecord.findMany({
    where: {
      userId,
      attendanceDate: {
        in: weekInfo.dates,
      },
    },
  });

  let totalWeeklyMinutes = 0;
  let daysPresent = 0;
  let daysLate = 0;

  weeklyRecords.forEach((r) => {
    if (r.checkInAt) {
      daysPresent += 1;
      totalWeeklyMinutes += r.workingMinutes;
      if (r.lateMinutes > 0) daysLate += 1;
    }
  });

  // Calculate Check-In Window (±30 mins band)
  let checkInWindow: {
    shiftStart: string;
    shiftEnd: string;
    windowStart: string;
    windowEnd: string;
    bandMinutes: number;
    isOpen: boolean;
    isTooEarly: boolean;
    isClosed: boolean;
    status: 'OPEN' | 'TOO_EARLY' | 'CLOSED';
  } | null = null;

  if (shift) {
    let bandMinutes = 30;
    try {
      const companySettings = await prisma.companySettings.findUnique({ where: { id: 'default-settings' } });
      if (companySettings?.attendanceRules) {
        const parsed = JSON.parse(companySettings.attendanceRules);
        if (parsed.checkInBandMinutes !== undefined) {
          bandMinutes = Number(parsed.checkInBandMinutes);
        }
      }
    } catch {}

    const expectedStart = parseKolkataTimeString(shift.startTime, todayDate);
    let windowStart = new Date(expectedStart.getTime() - bandMinutes * 60 * 1000);
    let windowEnd = new Date(expectedStart.getTime() + bandMinutes * 60 * 1000);

    const now = new Date();
    const nowMs = now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    if (Math.abs(nowMs - (expectedStart.getTime() - dayMs)) < Math.abs(nowMs - expectedStart.getTime())) {
      windowStart = new Date(windowStart.getTime() - dayMs);
      windowEnd = new Date(windowEnd.getTime() - dayMs);
    } else if (Math.abs(nowMs - (expectedStart.getTime() + dayMs)) < Math.abs(nowMs - expectedStart.getTime())) {
      windowStart = new Date(windowStart.getTime() + dayMs);
      windowEnd = new Date(windowEnd.getTime() + dayMs);
    }

    const isOpen = nowMs >= windowStart.getTime() && nowMs <= windowEnd.getTime();
    const isTooEarly = nowMs < windowStart.getTime();
    const isClosed = nowMs > windowEnd.getTime();

    checkInWindow = {
      shiftStart: shift.startTime,
      shiftEnd: shift.endTime,
      windowStart: formatKolkataTime(windowStart),
      windowEnd: formatKolkataTime(windowEnd),
      bandMinutes,
      isOpen,
      isTooEarly,
      isClosed,
      status: isOpen ? 'OPEN' : isTooEarly ? 'TOO_EARLY' : 'CLOSED',
    };
  }

  return {
    today: {
      date: todayDate,
      formattedDate: formatKolkataDate(todayDate),
      dayOfWeek: getDayOfWeekName(todayDate),
      isCheckedIn,
      isCheckedOut,
      checkInAt: todayRecord?.checkInAt || null,
      checkOutAt: todayRecord?.checkOutAt || null,
      formattedCheckInTime: formatKolkataTime(todayRecord?.checkInAt),
      formattedCheckOutTime: formatKolkataTime(todayRecord?.checkOutAt),
      status: todayRecord?.status || (isCheckedIn ? AttendanceStatuses.PRESENT : 'NOT_MARKED'),
      workingMinutes: liveDurationMinutes,
      workingHours: Number((liveDurationMinutes / 60).toFixed(2)),
      breakMinutes: todayRecord?.breakMinutes || 0,
      lateMinutes: todayRecord?.lateMinutes || 0,
    },
    shift: shift ? {
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      gracePeriodMinutes: shift.gracePeriodMinutes,
    } : null,
    checkInWindow,
    weeklySummary: {
      startDate: weekInfo.startOfWeek,
      endDate: weekInfo.endOfWeek,
      daysPresent,
      daysLate,
      totalHours: Number((totalWeeklyMinutes / 60).toFixed(2)),
    },
  };
}

/**
 * Worker's recent attendance records (self-view only)
 */
export async function getWorkerAttendanceHistory(
  userId: string,
  limit: number = 30,
  startDate?: string,
  endDate?: string
) {
  const where: any = { userId };

  if (startDate && endDate) {
    where.attendanceDate = {
      gte: startDate,
      lte: endDate,
    };
  } else if (startDate) {
    where.attendanceDate = { gte: startDate };
  } else if (endDate) {
    where.attendanceDate = { lte: endDate };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    orderBy: { attendanceDate: 'desc' },
    take: limit,
  });

  return records.map((r) => ({
    id: r.id,
    date: r.attendanceDate,
    formattedDate: formatKolkataDate(r.attendanceDate),
    dayOfWeek: getDayOfWeekName(r.attendanceDate),
    checkInTime: formatKolkataTime(r.checkInAt),
    checkOutTime: formatKolkataTime(r.checkOutAt),
    checkInAt: r.checkInAt,
    checkOutAt: r.checkOutAt,
    workingHours: Number((r.workingMinutes / 60).toFixed(2)),
    breakMinutes: r.breakMinutes,
    status: r.status,
    lateMinutes: r.lateMinutes,
    isMissingCheckOut: r.isMissingCheckOut,
    remarks: r.remarks,
  }));
}

/**
 * Admin / Supervisor attendance list with pagination & filters
 */
export async function listAttendanceRecords(params: {
  date?: string;
  startDate?: string;
  endDate?: string;
  workerId?: string;
  departmentId?: string;
  status?: string;
  isMissingCheckOut?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.date) {
    where.attendanceDate = params.date;
  } else if (params.startDate && params.endDate) {
    where.attendanceDate = {
      gte: params.startDate,
      lte: params.endDate,
    };
  } else if (params.startDate) {
    where.attendanceDate = { gte: params.startDate };
  } else if (params.endDate) {
    where.attendanceDate = { lte: params.endDate };
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.isMissingCheckOut !== undefined) {
    where.isMissingCheckOut = params.isMissingCheckOut;
  }

  if (params.workerId) {
    where.workerId = { contains: params.workerId.trim().toUpperCase() };
  }

  if (params.departmentId) {
    where.user = {
      departmentId: params.departmentId,
    };
  }

  const [total, records] = await Promise.all([
    prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            workerId: true,
            phone: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ attendanceDate: 'desc' }, { checkInAt: 'desc' }],
      skip,
      take: limit,
    }),
  ]);

  const formatted = records.map((r) => ({
    id: r.id,
    userId: r.userId,
    workerId: r.workerId,
    workerName: r.user.name,
    phone: r.user.phone,
    department: r.user.department?.name || 'Unassigned',
    departmentId: r.user.department?.id || null,
    attendanceDate: r.attendanceDate,
    formattedDate: formatKolkataDate(r.attendanceDate),
    dayOfWeek: getDayOfWeekName(r.attendanceDate),
    checkInAt: r.checkInAt,
    checkOutAt: r.checkOutAt,
    checkInTime: formatKolkataTime(r.checkInAt),
    checkOutTime: formatKolkataTime(r.checkOutAt),
    workingMinutes: r.workingMinutes,
    workingHours: Number((r.workingMinutes / 60).toFixed(2)),
    breakMinutes: r.breakMinutes,
    overtimeMinutes: r.overtimeMinutes,
    lateMinutes: r.lateMinutes,
    status: r.status,
    source: r.source,
    isMissingCheckOut: r.isMissingCheckOut,
    remarks: r.remarks,
  }));

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    records: formatted,
  };
}

/**
 * Authorized manual correction with mandatory reason & audit log
 */
export async function correctAttendanceRecord(
  recordId: string,
  updateData: {
    checkInAt?: string | null;
    checkOutAt?: string | null;
    status?: AttendanceStatusType;
    remarks?: string;
  },
  adminUser: { id: string; name: string },
  reason: string
) {
  if (!reason || reason.trim().length < 5) {
    throw new Error('A mandatory correction reason (minimum 5 characters) is required for audit compliance.');
  }

  const existing = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    include: {
      user: {
        include: {
          workerShifts: {
            where: { effectiveTo: null },
            include: { shift: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!existing) {
    throw new Error('Attendance record not found.');
  }

  const shift = existing.user.workerShifts[0]?.shift || null;

  const newCheckIn = updateData.checkInAt !== undefined
    ? (updateData.checkInAt ? new Date(updateData.checkInAt) : null)
    : existing.checkInAt;

  const newCheckOut = updateData.checkOutAt !== undefined
    ? (updateData.checkOutAt ? new Date(updateData.checkOutAt) : null)
    : existing.checkOutAt;

  let calc = {
    workingMinutes: existing.workingMinutes,
    breakMinutes: existing.breakMinutes,
    overtimeMinutes: existing.overtimeMinutes,
    lateMinutes: existing.lateMinutes,
    status: (updateData.status || existing.status) as AttendanceStatusType,
    isMissingCheckOut: false,
  };

  if (newCheckIn) {
    const calculated = calculateWorkingHoursAndStatus(
      newCheckIn,
      newCheckOut,
      shift,
      existing.attendanceDate
    );
    calc = {
      workingMinutes: calculated.workingMinutes,
      breakMinutes: calculated.breakMinutes,
      overtimeMinutes: calculated.overtimeMinutes,
      lateMinutes: calculated.lateMinutes,
      status: updateData.status || calculated.status,
      isMissingCheckOut: Boolean(newCheckIn && !newCheckOut),
    };
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      checkInAt: newCheckIn,
      checkOutAt: newCheckOut,
      workingMinutes: calc.workingMinutes,
      breakMinutes: calc.breakMinutes,
      overtimeMinutes: calc.overtimeMinutes,
      lateMinutes: calc.lateMinutes,
      status: calc.status,
      source: AttendanceSources.MANUAL_CORRECTION,
      isMissingCheckOut: calc.isMissingCheckOut,
      remarks: updateData.remarks || existing.remarks,
    },
  });

  // Mandatory Audit Log
  await logAudit({
    actorUserId: adminUser.id,
    actorName: adminUser.name,
    action: 'CORRECTION',
    entityType: 'ATTENDANCE',
    entityId: updated.id,
    reason: reason.trim(),
    details: {
      workerId: existing.workerId,
      attendanceDate: existing.attendanceDate,
      previous: {
        checkInAt: existing.checkInAt,
        checkOutAt: existing.checkOutAt,
        status: existing.status,
      },
      updated: {
        checkInAt: newCheckIn,
        checkOutAt: newCheckOut,
        status: calc.status,
      },
    },
  });

  return updated;
}

/**
 * Get currently checked-in workers for live monitoring
 */
export async function getCurrentlyCheckedInWorkers(departmentId?: string) {
  const todayDate = getKolkataDateString(new Date());

  const where: any = {
    attendanceDate: todayDate,
    checkInAt: { not: null },
    checkOutAt: null,
  };

  if (departmentId) {
    where.user = { departmentId };
  }

  const activeRecords = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          workerId: true,
          name: true,
          phone: true,
          department: { select: { id: true, name: true } },
          workerShifts: {
            where: { effectiveTo: null },
            include: { shift: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { checkInAt: 'desc' },
  });

  const now = new Date();

  return activeRecords.map((r) => {
    const rawElapsed = r.checkInAt ? Math.round((now.getTime() - r.checkInAt.getTime()) / (60 * 1000)) : 0;
    const shift = r.user.workerShifts[0]?.shift;

    return {
      recordId: r.id,
      userId: r.user.id,
      workerId: r.user.workerId,
      workerName: r.user.name,
      phone: r.user.phone,
      department: r.user.department?.name || 'Unassigned',
      shiftName: shift?.name || 'General Shift',
      checkInTime: formatKolkataTime(r.checkInAt),
      checkInAt: r.checkInAt,
      elapsedMinutes: rawElapsed,
      elapsedHours: Number((rawElapsed / 60).toFixed(2)),
      lateMinutes: r.lateMinutes,
      status: r.status,
    };
  });
}
