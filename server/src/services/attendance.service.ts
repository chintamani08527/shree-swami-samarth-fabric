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

// In-memory cache for default shift (5-minute TTL)
let cachedDefaultShift: any = null;
let cachedShiftTime = 0;

async function getDefaultActiveShift() {
  const now = Date.now();
  if (cachedDefaultShift && now - cachedShiftTime < 300000) {
    return cachedDefaultShift;
  }
  cachedDefaultShift = await prisma.shift.findFirst({ where: { isActive: true } });
  cachedShiftTime = now;
  return cachedDefaultShift;
}

/**
 * Haversine formula to compute great-circle distance between two GPS coordinates in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's mean radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Verify worker's coordinates against factory Unit 1 and Unit 2 geofences
 */
export async function verifyFactoryGeofence(
  latitude?: number | null,
  longitude?: number | null
) {
  const settings = await prisma.companySettings.findUnique({
    where: { id: 'default-settings' },
  });

  let rules: any = DEFAULT_ATTENDANCE_RULES;
  if (settings?.attendanceRules) {
    try {
      rules = { ...DEFAULT_ATTENDANCE_RULES, ...JSON.parse(settings.attendanceRules) };
    } catch {}
  }

  const geofencingEnabled = rules.geofencingEnabled ?? true;
  const geofenceRadius = Number(rules.geofenceRadiusMeters ?? DEFAULT_ATTENDANCE_RULES.geofenceRadiusMeters);

  const u1Lat = Number(rules.unit1Lat ?? DEFAULT_ATTENDANCE_RULES.unit1Lat);
  const u1Lng = Number(rules.unit1Lng ?? DEFAULT_ATTENDANCE_RULES.unit1Lng);
  const u1Name = rules.unit1Name || DEFAULT_ATTENDANCE_RULES.unit1Name;

  const u2Lat = Number(rules.unit2Lat ?? DEFAULT_ATTENDANCE_RULES.unit2Lat);
  const u2Lng = Number(rules.unit2Lng ?? DEFAULT_ATTENDANCE_RULES.unit2Lng);
  const u2Name = rules.unit2Name || DEFAULT_ATTENDANCE_RULES.unit2Name;

  if (!geofencingEnabled) {
    return {
      isWithinPremises: true,
      geofencingEnabled: false,
      detectedUnit: 'Factory Premises',
      distanceToUnit1: null,
      distanceToUnit2: null,
      nearestUnitName: null,
      nearestDistance: null,
      geofenceRadiusMeters: geofenceRadius,
      message: 'Geofencing is currently disabled.',
      unit1: { name: u1Name, latitude: u1Lat, longitude: u1Lng },
      unit2: { name: u2Name, latitude: u2Lat, longitude: u2Lng },
    };
  }

  if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) {
    return {
      isWithinPremises: false,
      geofencingEnabled: true,
      detectedUnit: null,
      distanceToUnit1: null,
      distanceToUnit2: null,
      nearestUnitName: null,
      nearestDistance: null,
      geofenceRadiusMeters: geofenceRadius,
      message: '📍 कृपया लोकेशन (GPS) चालू करा. लोकेशन शिवाय हजेरी नोंदवता येणार नाही. (Please turn ON GPS to check in/out).',
      unit1: { name: u1Name, latitude: u1Lat, longitude: u1Lng },
      unit2: { name: u2Name, latitude: u2Lat, longitude: u2Lng },
    };
  }

  const dist1 = calculateHaversineDistance(latitude, longitude, u1Lat, u1Lng);
  const dist2 = calculateHaversineDistance(latitude, longitude, u2Lat, u2Lng);

  const within1 = dist1 <= geofenceRadius;
  const within2 = dist2 <= geofenceRadius;

  let detectedUnit: string | null = null;
  if (within1 && within2) {
    detectedUnit = dist1 <= dist2 ? u1Name : u2Name;
  } else if (within1) {
    detectedUnit = u1Name;
  } else if (within2) {
    detectedUnit = u2Name;
  }

  const nearestUnitName = dist1 <= dist2 ? u1Name : u2Name;
  const nearestDistance = Math.min(dist1, dist2);
  const isWithinPremises = Boolean(within1 || within2);

  return {
    isWithinPremises,
    geofencingEnabled,
    detectedUnit: detectedUnit || (isWithinPremises ? nearestUnitName : 'Outside Factory'),
    distanceToUnit1: dist1,
    distanceToUnit2: dist2,
    nearestUnitName,
    nearestDistance,
    geofenceRadiusMeters: geofenceRadius,
    message: isWithinPremises
      ? `✅ फॅक्टरी आवारात आहात: ${detectedUnit} (${nearestDistance}m अंतर)`
      : `❌ तुम्ही फॅक्टरी आवाराच्या बाहेर आहात. अंतर: ${nearestDistance}m (${nearestUnitName} पासून). कमाल मर्यादा: ${geofenceRadius}m. कृपया फॅक्टरी आवारात येऊन हजेरी नोंदवा.`,
    unit1: { name: u1Name, latitude: u1Lat, longitude: u1Lng },
    unit2: { name: u2Name, latitude: u2Lat, longitude: u2Lng },
  };
}

/**
 * Worker check-in action
 */
export async function processCheckIn(
  userId: string,
  source: AttendanceSourceType = AttendanceSources.WEB_MOBILE,
  adminActor?: { id: string; name: string },
  shiftChoice?: 'DAY' | 'NIGHT' | string,
  location?: { latitude?: number | null; longitude?: number | null }
) {
  const serverNow = new Date(); // Server-authoritative timestamp
  const attendanceDate = getKolkataDateString(serverNow);

  // If not admin override, verify geofence
  let geoResult: any = null;
  if (!adminActor) {
    geoResult = await verifyFactoryGeofence(location?.latitude, location?.longitude);
    if (geoResult.geofencingEnabled && !geoResult.isWithinPremises) {
      throw new Error(geoResult.message);
    }
  }

  // Fetch worker and active record in parallel
  const [user, existingRecord] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        workerShifts: {
          where: { effectiveTo: null },
          include: { shift: true },
          take: 1,
        },
      },
    }),
    prisma.attendanceRecord.findUnique({
      where: {
        userId_attendanceDate: {
          userId,
          attendanceDate,
        },
      },
    }),
  ]);

  if (!user) {
    throw new Error('Worker profile not found. Please log in again.');
  }

  if (!user.isActive) {
    throw new Error('Worker account has been deactivated by administrator.');
  }

  if (existingRecord && existingRecord.checkInAt) {
    throw new Error(
      `Attendance already recorded: Checked in at ${formatKolkataTime(existingRecord.checkInAt)} today.`
    );
  }

  // Check if worker has an active overnight night shift from yesterday that is still ongoing
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
    const elapsedHours = (serverNow.getTime() - openYesterdayRecord.checkInAt.getTime()) / (3600 * 1000);
    if (elapsedHours < 18) {
      throw new Error(
        `Active Night Shift in progress: You checked in yesterday at ${formatKolkataTime(openYesterdayRecord.checkInAt)}. Please tap Check Out to conclude your shift.`
      );
    }
  }

  // Determine normalized shift choice: 'DAY' or 'NIGHT'
  let normalizedShiftType: 'DAY' | 'NIGHT' = 'DAY';
  if (shiftChoice) {
    const s = String(shiftChoice).toUpperCase();
    if (s.includes('NIGHT') || s === 'N') normalizedShiftType = 'NIGHT';
    else normalizedShiftType = 'DAY';
  } else {
    // Default based on current hour: after 19:00 or before 07:00 => NIGHT
    const currentHour = parseInt(
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
      }).format(serverNow),
      10
    );
    normalizedShiftType = (currentHour >= 19 || currentHour < 7) ? 'NIGHT' : 'DAY';
  }

  // Find corresponding shift definition (prioritize company standard 8-to-8 shifts)
  let shift: any = null;
  if (normalizedShiftType === 'NIGHT') {
    shift = await prisma.shift.findFirst({
      where: {
        OR: [{ name: { contains: 'Night' } }, { startTime: '20:00' }],
        isActive: true,
      },
    });
  } else {
    shift = await prisma.shift.findFirst({
      where: {
        OR: [{ name: { contains: 'Day' } }, { startTime: '08:00' }],
        isActive: true,
      },
    });
  }

  if (!shift) {
    shift = user.workerShifts[0]?.shift || await prisma.shift.findFirst({ where: { isActive: true } });
  }

  // Band timing restriction REMOVED per user instruction: workers can check in anytime for their selected shift

  // Calculate working hours & status (no band restriction)
  const calc = calculateWorkingHoursAndStatus(serverNow, null, shift, attendanceDate);

  const checkInData = {
    checkInAt: serverNow,
    shiftType: normalizedShiftType,
    status: calc.status,
    lateMinutes: calc.lateMinutes,
    source,
    isMissingCheckOut: false,
    checkInLatitude: location?.latitude ?? null,
    checkInLongitude: location?.longitude ?? null,
    checkInLocationUnit: geoResult?.detectedUnit ?? (adminActor ? 'Admin Override' : 'Factory Premises'),
    locationVerified: geoResult?.isWithinPremises ?? Boolean(adminActor),
  };

  let record: any;
  try {
    record = await prisma.attendanceRecord.upsert({
      where: {
        userId_attendanceDate: {
          userId,
          attendanceDate,
        },
      },
      update: checkInData,
      create: {
        userId,
        workerId: user.workerId,
        attendanceDate,
        ...checkInData,
      },
    });
  } catch (err: any) {
    if (err?.code === 'P2002' || err?.message?.includes('Unique constraint')) {
      const existing = await prisma.attendanceRecord.findUnique({
        where: { userId_attendanceDate: { userId, attendanceDate } },
      });
      if (existing) {
        record = existing;
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (adminActor) {
    await logAudit({
      actorUserId: adminActor.id,
      actorName: adminActor.name,
      action: 'ADMIN_CHECK_IN',
      entityType: 'ATTENDANCE',
      entityId: record.id,
      reason: 'Admin marked check-in on behalf of worker',
      details: { workerId: user.workerId, attendanceDate, checkInAt: serverNow, shiftType: normalizedShiftType },
    });
  }

  const shiftLabel = normalizedShiftType === 'NIGHT' ? 'Night Shift 🌙' : 'Day Shift ☀️';
  const isLate = record.status === AttendanceStatuses.LATE || calc.status === AttendanceStatuses.LATE;
  const lateNote = isLate
    ? ` ⚠️ उशिरा नोंद (Late Mark: ${record.lateMinutes || calc.lateMinutes} मिनिटे उशीर - कटऑफ: ${normalizedShiftType === 'NIGHT' ? '9:00 PM' : '9:00 AM'})`
    : '';

  return {
    record,
    worker: {
      id: user.id,
      workerId: user.workerId,
      name: user.name,
    },
    message: `Namaste ${user.name}! ${shiftLabel} check-in recorded at ${formatKolkataTime(serverNow)}.${lateNote}`,
  };
}

/**
 * Calculate shift earnings breakdown for celebratory feedback and daily record
 */
export function calculateShiftEarnings(
  user: {
    wageType?: string | null;
    dailyWage?: number | null;
    customWageRate?: number | null;
    hasCustomWageAccess?: boolean | null;
  },
  record: {
    shiftType?: string | null;
    machinesOperated?: number | null;
    hoursOperated?: number | null;
    overtimeMachines?: number | null;
    overtimeHours?: number | null;
    overtimeMinutes?: number | null;
    overtimeStatus?: string | null;
    overtimeApprovedAt?: Date | null;
    overtimeApprovedBy?: string | null;
    overtimeRejectionReason?: string | null;
  },
  workingMinutes: number,
  status: string
) {
  const isCustom = (user.wageType === 'CUSTOM' || Boolean(user.hasCustomWageAccess)) && Boolean(user.customWageRate && user.customWageRate > 0);
  let baseEarned = 0;
  let overtimeEarned = 0;

  const rawHours = Number((workingMinutes / 60).toFixed(2));
  const defaultShiftHours = 12.0;
  const hoursWorked = (record.hoursOperated !== null && record.hoursOperated !== undefined && record.hoursOperated > 0)
    ? record.hoursOperated
    : (rawHours > 0 ? rawHours : defaultShiftHours);

  const otM = record.overtimeMachines ?? 0;
  const otH = record.overtimeHours ?? Number(((record.overtimeMinutes || 0) / 60).toFixed(1));

  let m = 0;
  let h = hoursWorked;

  if (isCustom) {
    const rate = user.customWageRate || 0;
    m = (record.machinesOperated !== null && record.machinesOperated !== undefined && record.machinesOperated > 0)
      ? record.machinesOperated
      : 1;
    baseEarned = Math.round(m * h * rate);

    if (otM > 0 && otH > 0) {
      overtimeEarned = Math.round(otM * otH * rate);
    } else if (otH > 0) {
      overtimeEarned = Math.round(otH * rate * m);
    }
  } else {
    // Fixed daily wage worker: Full shift pay (e.g. ₹1000)
    const dailyRate = user.dailyWage || 1000;
    m = record.machinesOperated ?? 0;
    if (status === 'HALF_DAY') {
      baseEarned = Math.round(dailyRate / 2);
    } else {
      baseEarned = Math.round(dailyRate);
    }

    if (otH > 0) {
      const hourlyRate = dailyRate / 12; // 12-hour factory shift
      overtimeEarned = Math.round(otH * hourlyRate);
    }
  }

  // Determine Overtime Approval Status: NONE, PENDING, APPROVED, REJECTED
  const hasOvertimeData = otH > 0 || otM > 0 || (record.overtimeMinutes || 0) > 0;
  const overtimeStatus = record.overtimeStatus || (hasOvertimeData ? 'PENDING' : 'NONE');
  const isOvertimeApproved = overtimeStatus === 'APPROVED';

  // "after approval salery should be added to regular"
  // If approved: add to regular salary.
  // If pending or rejected: only regular base pay is in totalEarned.
  const totalEarned = isOvertimeApproved ? Math.max(0, baseEarned + overtimeEarned) : Math.max(0, baseEarned);

  const formula = isCustom
    ? `${m} Loom(s) • ${h} hrs`
    : `Standard Shift`;

  return {
    totalEarned,
    baseEarned,
    overtimeEarned,
    overtimeStatus,
    isOvertimeApproved,
    overtimePendingAmount: isOvertimeApproved ? 0 : overtimeEarned,
    overtimeApprovedAt: record.overtimeApprovedAt || null,
    overtimeApprovedBy: record.overtimeApprovedBy || null,
    overtimeRejectionReason: record.overtimeRejectionReason || null,
    wageType: isCustom ? 'CUSTOM' : 'FIXED',
    customRate: user.customWageRate ? Number(user.customWageRate.toFixed(2)) : 0,
    dailyWage: user.dailyWage || 1000,
    machinesOperated: m,
    hoursOperated: h,
    overtimeMachines: otM,
    overtimeHours: otH,
    shiftType: record.shiftType || 'DAY',
    status,
    formula,
  };
}

/**
 * Worker check-out action
 */
export async function processCheckOut(
  userId: string,
  source: AttendanceSourceType = AttendanceSources.WEB_MOBILE,
  adminActor?: { id: string; name: string },
  customDetails?: {
    machinesOperated?: number | null;
    hoursOperated?: number | null;
    overtimeMachines?: number | null;
    overtimeHours?: number | null;
  },
  location?: { latitude?: number | null; longitude?: number | null }
) {
  const serverNow = new Date(); // Server-authoritative timestamp
  const attendanceDate = getKolkataDateString(serverNow);

  // If not admin override, verify geofence
  let geoResult: any = null;
  if (!adminActor) {
    geoResult = await verifyFactoryGeofence(location?.latitude, location?.longitude);
    if (geoResult.geofencingEnabled && !geoResult.isWithinPremises) {
      throw new Error(geoResult.message);
    }
  }

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

  if (!user) {
    throw new Error('Worker profile not found. Please log in again.');
  }

  if (!user.isActive) {
    throw new Error('Worker account has been deactivated by administrator.');
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

  // If no record found for today's date or today's record has no check-in, check if there is an active overnight record from yesterday
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
    }
  }

  const yesterday = new Date(serverNow.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDate = getKolkataDateString(yesterday);

  // If today's record doesn't exist, has no check-in, or is already checked out: check if there's an active overnight record from yesterday
  if (!record || !record.checkInAt || record.checkOutAt) {
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
    } else if (!record || !record.checkInAt) {
      throw new Error('No active check-in found. Please tap Check In when you arrive at the factory.');
    }
  }

  if (record.checkOutAt) {
    throw new Error(
      `Check-out already completed at ${formatKolkataTime(record.checkOutAt)}. Have a restful time!`
    );
  }

  // Find corresponding shift definition (prioritize 8-to-8 Day or Night shifts)
  let shift: any = null;
  if (record.shiftType === 'NIGHT') {
    shift = await prisma.shift.findFirst({
      where: {
        OR: [{ name: { contains: 'Night' } }, { startTime: '20:00' }],
        isActive: true,
      },
    });
  } else {
    shift = await prisma.shift.findFirst({
      where: {
        OR: [{ name: { contains: 'Day' } }, { startTime: '08:00' }],
        isActive: true,
      },
    });
  }
  if (!shift) {
    shift = user.workerShifts[0]?.shift || await prisma.shift.findFirst({ where: { isActive: true } });
  }

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
      overtimeMinutes: customDetails?.overtimeHours !== undefined && customDetails.overtimeHours !== null
        ? Math.max(calc.overtimeMinutes, Math.round(Number(customDetails.overtimeHours) * 60))
        : calc.overtimeMinutes,
      lateMinutes: calc.lateMinutes,
      status: calc.status,
      isMissingCheckOut: false,
      machinesOperated: (customDetails?.machinesOperated !== undefined && customDetails.machinesOperated !== null)
        ? Number(customDetails.machinesOperated)
        : (record.machinesOperated ?? (user.wageType === 'CUSTOM' || user.hasCustomWageAccess ? 1 : null)),
      hoursOperated: (customDetails?.hoursOperated !== undefined && customDetails.hoursOperated !== null)
        ? Number(customDetails.hoursOperated)
        : (record.hoursOperated ?? calc.workingHours),
      ...(customDetails?.overtimeMachines !== undefined && customDetails.overtimeMachines !== null
        ? { overtimeMachines: Number(customDetails.overtimeMachines) }
        : {}),
      ...(customDetails?.overtimeHours !== undefined && customDetails.overtimeHours !== null
        ? { overtimeHours: Number(customDetails.overtimeHours) }
        : {}),
      ...(Number(customDetails?.overtimeHours || 0) > 0 || Number(customDetails?.overtimeMachines || 0) > 0
        ? { overtimeStatus: 'PENDING', overtimeApprovedAt: null, overtimeApprovedBy: null }
        : {}),
      checkOutLatitude: location?.latitude ?? null,
      checkOutLongitude: location?.longitude ?? null,
      checkOutLocationUnit: geoResult?.detectedUnit ?? (adminActor ? 'Admin Override' : 'Factory Premises'),
      locationVerified: geoResult?.isWithinPremises ?? Boolean(adminActor),
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
      details: {
        workerId: user.workerId,
        checkOutAt: serverNow,
        workingMinutes: calc.workingMinutes,
        machinesOperated: updatedRecord.machinesOperated,
        hoursOperated: updatedRecord.hoursOperated,
      },
    });
  }

  const earnings = calculateShiftEarnings(
    user,
    updatedRecord,
    calc.workingMinutes,
    calc.status
  );

  return {
    record: updatedRecord,
    workingHours: calc.workingHours,
    breakMinutes: calc.breakMinutes,
    overtimeMinutes: updatedRecord.overtimeMinutes,
    machinesOperated: updatedRecord.machinesOperated,
    hoursOperated: updatedRecord.hoursOperated,
    overtimeMachines: updatedRecord.overtimeMachines,
    overtimeHours: updatedRecord.overtimeHours,
    earnings,
    message: `Thank you, ${user.name}! Check-out recorded at ${formatKolkataTime(serverNow)}. Total working hours: ${calc.workingHours} hrs.`,
  };
}

/**
 * Worker logs or updates custom wage details (how many machines and how many hours operated)
 */
export async function logCustomWageWork(
  userId: string,
  data: {
    machinesOperated?: number | null;
    hoursOperated?: number | null;
    overtimeMachines?: number | null;
    overtimeHours?: number | null;
    remarks?: string;
  }
) {
  const serverNow = new Date();
  const attendanceDate = getKolkataDateString(serverNow);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('Worker profile not found. Please log in again.');
  }

  if (!user.isActive) {
    throw new Error('Worker account has been deactivated by administrator.');
  }

  const isOvertimeLogging = (data.overtimeMachines !== undefined || data.overtimeHours !== undefined) &&
    data.machinesOperated === undefined && data.hoursOperated === undefined;
  if (!user.hasCustomWageAccess && user.wageType !== 'CUSTOM' && !isOvertimeLogging) {
    throw new Error('Custom wage access has not been granted for this account. Please contact Factory Admin to enable custom wages.');
  }

  let record = await prisma.attendanceRecord.findUnique({
    where: {
      userId_attendanceDate: {
        userId,
        attendanceDate,
      },
    },
  });

  // If no record found for today's date or today's record has no check-in, check if there is an active overnight record from yesterday
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
    }
  }

  const wageFields = {
    ...(data.machinesOperated !== undefined ? { machinesOperated: data.machinesOperated !== null ? Number(data.machinesOperated) : null } : {}),
    ...(data.hoursOperated !== undefined ? { hoursOperated: data.hoursOperated !== null ? Number(data.hoursOperated) : null } : {}),
    ...(data.overtimeMachines !== undefined ? { overtimeMachines: data.overtimeMachines !== null ? Number(data.overtimeMachines) : null } : {}),
    ...(data.overtimeHours !== undefined ? { overtimeHours: data.overtimeHours !== null ? Number(data.overtimeHours) : null } : {}),
    ...(Number(data.overtimeMachines || 0) > 0 || Number(data.overtimeHours || 0) > 0
      ? { overtimeStatus: 'PENDING', overtimeApprovedAt: null, overtimeApprovedBy: null }
      : {}),
    ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
  };

  if (record) {
    record = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: wageFields,
    });
  } else {
    try {
      record = await prisma.attendanceRecord.upsert({
        where: {
          userId_attendanceDate: {
            userId,
            attendanceDate,
          },
        },
        update: wageFields,
        create: {
          userId,
          workerId: user.workerId,
          attendanceDate,
          status: AttendanceStatuses.PRESENT,
          source: AttendanceSources.WEB_MOBILE,
          ...wageFields,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        record = await prisma.attendanceRecord.update({
          where: { userId_attendanceDate: { userId, attendanceDate } },
          data: wageFields,
        });
      } else {
        throw err;
      }
    }
  }

  return record;
}

/**
 * Get Worker's current status and personal summary
 */
export async function getWorkerStatus(userId: string) {
  const serverNow = new Date();
  const todayDate = getKolkataDateString(serverNow);
  const yesterday = new Date(serverNow.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDate = getKolkataDateString(yesterday);
  const weekInfo = getWeekDateRange(todayDate);

  // Parallelize user, today record, yesterday record, and weekly records lookups
  const [user, todayRecord, yesterdayRecord, weeklyRecords, companySettings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        workerShifts: {
          where: { effectiveTo: null },
          include: { shift: true },
          take: 1,
        },
      },
    }),
    prisma.attendanceRecord.findUnique({
      where: {
        userId_attendanceDate: {
          userId,
          attendanceDate: todayDate,
        },
      },
    }),
    prisma.attendanceRecord.findUnique({
      where: {
        userId_attendanceDate: {
          userId,
          attendanceDate: yesterdayDate,
        },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        userId,
        attendanceDate: {
          in: weekInfo.dates,
        },
      },
    }),
    prisma.companySettings.findUnique({
      where: { id: 'default-settings' },
    }),
  ]);

  if (!user) throw new Error('Worker not found');

  let activeRules: any = DEFAULT_ATTENDANCE_RULES;
  if (companySettings?.attendanceRules) {
    try {
      activeRules = { ...DEFAULT_ATTENDANCE_RULES, ...JSON.parse(companySettings.attendanceRules) };
    } catch {}
  }

  // Determine active display record:
  // If yesterday has an open overnight shift (checked in, not checked out, within 22 hrs), it represents the active ongoing shift!
  const isYesterdayOvernightOpen = Boolean(
    yesterdayRecord?.checkInAt &&
    !yesterdayRecord?.checkOutAt &&
    (serverNow.getTime() - yesterdayRecord.checkInAt.getTime()) < 22 * 60 * 60 * 1000
  );

  let activeRecord: any = null;
  let isOvernightNightShift = false;

  if (isYesterdayOvernightOpen) {
    activeRecord = yesterdayRecord;
    isOvernightNightShift = true;
  } else if (todayRecord?.checkInAt) {
    activeRecord = todayRecord;
  } else if (
    yesterdayRecord?.checkOutAt &&
    (serverNow.getTime() - yesterdayRecord.checkOutAt.getTime()) < 6 * 60 * 60 * 1000 &&
    parseInt(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(serverNow), 10) < 14
  ) {
    // Recently completed night shift this morning (within 6 hrs and before 2 PM)
    activeRecord = yesterdayRecord;
  } else {
    activeRecord = todayRecord;
  }

  // Find corresponding shift definition (prioritizing 8-to-8 Day or Night shifts)
  let shift: any = null;
  const targetShiftType = activeRecord?.shiftType || (isOvernightNightShift ? 'NIGHT' : null);
  if (targetShiftType === 'NIGHT') {
    shift = await prisma.shift.findFirst({
      where: {
        OR: [{ name: { contains: 'Night' } }, { startTime: '20:00' }],
        isActive: true,
      },
    });
  } else if (targetShiftType === 'DAY') {
    shift = await prisma.shift.findFirst({
      where: {
        OR: [{ name: { contains: 'Day' } }, { startTime: '08:00' }],
        isActive: true,
      },
    });
  }
  if (!shift) {
    shift = user.workerShifts[0]?.shift || await getDefaultActiveShift();
  }

  // Calculate live working duration if checked in and not checked out
  let liveDurationMinutes = 0;
  let isCheckedIn = false;
  let isCheckedOut = false;

  if (activeRecord?.checkInAt) {
    isCheckedIn = true;
    if (activeRecord.checkOutAt) {
      isCheckedOut = true;
      liveDurationMinutes = activeRecord.workingMinutes;
    } else {
      const rawElapsed = Math.round((serverNow.getTime() - activeRecord.checkInAt.getTime()) / (60 * 1000));
      // Deduct break if applicable
      const breakDed = rawElapsed >= (DEFAULT_ATTENDANCE_RULES.autoDeductBreakThresholdMinutes)
        ? (shift?.breakDurationMinutes || 60)
        : 0;
      liveDurationMinutes = Math.max(0, rawElapsed - breakDed);
    }
  }

  let totalWeeklyMinutes = 0;
  let daysPresent = 0;
  let daysLate = 0;
  let totalWeeklyEarnings = 0;
  let totalWeeklyBaseEarnings = 0;
  let totalWeeklyApprovedOvertime = 0;
  let totalWeeklyPendingOvertime = 0;
  let completedShiftsCount = 0;

  weeklyRecords.forEach((r) => {
    if (r.checkInAt) {
      daysPresent += 1;
      if (r.lateMinutes > 0) daysLate += 1;

      // Only calculate and add shift earnings to weekly salary AFTER check-out!
      // When shift is completed (checkOutAt is present), machinesOperated and hoursOperated are verified.
      if (r.checkOutAt) {
        completedShiftsCount += 1;
        totalWeeklyMinutes += r.workingMinutes;

        const shiftEarnings = calculateShiftEarnings(
          user,
          r,
          r.workingMinutes,
          r.status
        );
        totalWeeklyEarnings += shiftEarnings.totalEarned;
        totalWeeklyBaseEarnings += shiftEarnings.baseEarned;
        if (shiftEarnings.isOvertimeApproved) {
          totalWeeklyApprovedOvertime += shiftEarnings.overtimeEarned;
        } else if (shiftEarnings.overtimeStatus === 'PENDING') {
          totalWeeklyPendingOvertime += shiftEarnings.overtimePendingAmount || shiftEarnings.overtimeEarned;
        }
      }
    }
  });

  // Band timing removed per user instruction - checkInWindow is null (unrestricted)
  const checkInWindow = null;

  const displayDate = activeRecord?.attendanceDate || todayDate;

  // Today's shift earnings: ONLY compute and show once the worker has completed check-out!
  // If activeRecord is checked-in but not checked-out, shift is in progress and earnings calculate upon check-out.
  let earnings: any = null;
  if (activeRecord && activeRecord.checkInAt && activeRecord.checkOutAt) {
    earnings = calculateShiftEarnings(
      user,
      activeRecord,
      activeRecord.workingMinutes,
      activeRecord.status || AttendanceStatuses.PRESENT
    );
  }

  return {
    today: {
      date: displayDate,
      formattedDate: formatKolkataDate(displayDate),
      dayOfWeek: getDayOfWeekName(displayDate),
      isCheckedIn,
      isCheckedOut,
      checkInAt: activeRecord?.checkInAt || null,
      checkOutAt: activeRecord?.checkOutAt || null,
      shiftType: activeRecord?.shiftType || (isOvernightNightShift ? 'NIGHT' : null),
      formattedCheckInTime: formatKolkataTime(activeRecord?.checkInAt),
      formattedCheckOutTime: formatKolkataTime(activeRecord?.checkOutAt),
      status: activeRecord?.status || (isCheckedIn ? AttendanceStatuses.PRESENT : 'NOT_MARKED'),
      workingMinutes: liveDurationMinutes,
      workingHours: Number((liveDurationMinutes / 60).toFixed(2)),
      breakMinutes: activeRecord?.breakMinutes || 0,
      lateMinutes: activeRecord?.lateMinutes || 0,
      machinesOperated: activeRecord?.machinesOperated ?? null,
      hoursOperated: activeRecord?.hoursOperated ?? null,
      overtimeMachines: activeRecord?.overtimeMachines ?? null,
      overtimeHours: activeRecord?.overtimeHours ?? (activeRecord?.overtimeMinutes ? Number((activeRecord.overtimeMinutes / 60).toFixed(1)) : null),
      overtimeStatus: activeRecord?.overtimeStatus || (activeRecord?.overtimeHours ? 'PENDING' : 'NONE'),
      overtimeApprovedAt: activeRecord?.overtimeApprovedAt || null,
      overtimeApprovedBy: activeRecord?.overtimeApprovedBy || null,
      overtimeRejectionReason: activeRecord?.overtimeRejectionReason || null,
      earnings,
    },
    worker: {
      wageType: user.wageType || 'FIXED',
      hasCustomWageAccess: Boolean(user.hasCustomWageAccess || user.wageType === 'CUSTOM'),
      dailyWage: user.dailyWage,
      customWageRate: user.customWageRate,
      unit: user.unit || 'Unit 1',
    },
    shift: shift ? {
      name: (activeRecord?.shiftType === 'NIGHT' || isOvernightNightShift)
        ? 'Night Shift (8:00 PM - 8:00 AM)'
        : (shift.name || 'Day Shift (8:00 AM - 8:00 PM)'),
      startTime: shift.startTime,
      endTime: shift.endTime,
      gracePeriodMinutes: shift.gracePeriodMinutes,
    } : {
      name: 'Day Shift (8:00 AM - 8:00 PM)',
      startTime: '08:00',
      endTime: '20:00',
      gracePeriodMinutes: 60,
    },
    checkInWindow,
    weeklySummary: {
      startDate: weekInfo.startOfWeek,
      endDate: weekInfo.endOfWeek,
      daysPresent,
      daysLate,
      totalHours: Number((totalWeeklyMinutes / 60).toFixed(2)),
      totalWeeklyEarnings,
      totalWeeklyBaseEarnings,
      totalWeeklyApprovedOvertime,
      totalWeeklyPendingOvertime,
      completedShiftsCount,
      hasOngoingShift: isCheckedIn && !isCheckedOut,
    },
    geofenceConfig: {
      enabled: activeRules.geofencingEnabled ?? true,
      radiusMeters: Number(activeRules.geofenceRadiusMeters ?? DEFAULT_ATTENDANCE_RULES.geofenceRadiusMeters),
      unit1: {
        name: activeRules.unit1Name || DEFAULT_ATTENDANCE_RULES.unit1Name,
        latitude: Number(activeRules.unit1Lat ?? DEFAULT_ATTENDANCE_RULES.unit1Lat),
        longitude: Number(activeRules.unit1Lng ?? DEFAULT_ATTENDANCE_RULES.unit1Lng),
      },
      unit2: {
        name: activeRules.unit2Name || DEFAULT_ATTENDANCE_RULES.unit2Name,
        latitude: Number(activeRules.unit2Lat ?? DEFAULT_ATTENDANCE_RULES.unit2Lat),
        longitude: Number(activeRules.unit2Lng ?? DEFAULT_ATTENDANCE_RULES.unit2Lng),
      },
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

  const [user, records] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        wageType: true,
        dailyWage: true,
        customWageRate: true,
        hasCustomWageAccess: true,
      },
    }),
    prisma.attendanceRecord.findMany({
      where,
      orderBy: { attendanceDate: 'desc' },
      take: limit,
    }),
  ]);

  return records.map((r) => {
    // Only calculate earnings for completed (checked-out) shifts
    const earnings = user && r.checkInAt && r.checkOutAt
      ? calculateShiftEarnings(user, r, r.workingMinutes, r.status)
      : null;

    return {
      id: r.id,
      date: r.attendanceDate,
      formattedDate: formatKolkataDate(r.attendanceDate),
      dayOfWeek: getDayOfWeekName(r.attendanceDate),
      checkInTime: formatKolkataTime(r.checkInAt),
      checkOutTime: formatKolkataTime(r.checkOutAt),
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      workingHours: r.checkOutAt ? Number((r.workingMinutes / 60).toFixed(2)) : 0,
      breakMinutes: r.breakMinutes,
      status: r.status,
      lateMinutes: r.lateMinutes,
      shiftType: r.shiftType || 'DAY',
      machinesOperated: r.machinesOperated ?? null,
      hoursOperated: r.hoursOperated ?? null,
      overtimeMachines: r.overtimeMachines ?? null,
      overtimeHours: r.overtimeHours ?? (r.overtimeMinutes ? Number((r.overtimeMinutes / 60).toFixed(1)) : null),
      overtimeStatus: r.overtimeStatus || 'NONE',
      overtimeApprovedAt: r.overtimeApprovedAt || null,
      overtimeApprovedBy: r.overtimeApprovedBy || null,
      overtimeRejectionReason: r.overtimeRejectionReason || null,
      isMissingCheckOut: r.isMissingCheckOut,
      remarks: r.remarks,
      earnings,
    };
  });
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
            wageType: true,
            hasCustomWageAccess: true,
            unit: true,
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
    wageType: r.user.wageType || 'FIXED',
    hasCustomWageAccess: Boolean(r.user.hasCustomWageAccess),
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
    shiftType: r.shiftType || 'DAY',
    unit: r.user.unit || 'Unit 1',
    machinesOperated: r.machinesOperated ?? null,
    hoursOperated: r.hoursOperated ?? null,
    overtimeMachines: r.overtimeMachines ?? null,
    overtimeHours: r.overtimeHours ?? (r.overtimeMinutes ? Number((r.overtimeMinutes / 60).toFixed(1)) : null),
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
    shiftType?: string | null;
    machinesOperated?: number | null;
    hoursOperated?: number | null;
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
      ...(updateData.shiftType !== undefined ? { shiftType: updateData.shiftType } : {}),
      ...(updateData.machinesOperated !== undefined ? { machinesOperated: updateData.machinesOperated !== null ? Number(updateData.machinesOperated) : null } : {}),
      ...(updateData.hoursOperated !== undefined ? { hoursOperated: updateData.hoursOperated !== null ? Number(updateData.hoursOperated) : null } : {}),
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
  const serverNow = new Date();
  const todayDate = getKolkataDateString(serverNow);
  const yesterday = new Date(serverNow.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDate = getKolkataDateString(yesterday);

  const where: any = {
    attendanceDate: { in: [todayDate, yesterdayDate] },
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

/**
 * Get overtime requests for admin portal review & approval
 */
export async function getOvertimeRequests(filter?: {
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const where: any = {
    OR: [
      { overtimeHours: { gt: 0 } },
      { overtimeMachines: { gt: 0 } },
      { overtimeMinutes: { gt: 0 } },
      { overtimeStatus: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
    ],
  };

  if (filter?.status && filter.status !== 'ALL') {
    where.overtimeStatus = filter.status;
  }

  if (filter?.startDate || filter?.endDate) {
    where.attendanceDate = {};
    if (filter.startDate) where.attendanceDate.gte = filter.startDate;
    if (filter.endDate) where.attendanceDate.lte = filter.endDate;
  }

  const limit = Math.min(1000, Math.max(1, filter?.limit || 250));

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          workerId: true,
          name: true,
          phone: true,
          role: true,
          unit: true,
          wageType: true,
          dailyWage: true,
          customWageRate: true,
          hasCustomWageAccess: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ attendanceDate: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  let totalPendingCount = 0;
  let totalPendingAmount = 0;
  let totalApprovedCount = 0;
  let totalApprovedAmount = 0;
  let totalRejectedCount = 0;

  const items = records.map((r) => {
    const isCustom = r.user.wageType === 'CUSTOM' || Boolean(r.user.hasCustomWageAccess);
    const otM = r.overtimeMachines ?? 0;
    const otH = r.overtimeHours ?? Number(((r.overtimeMinutes || 0) / 60).toFixed(1));
    let estimatedOtPay = 0;

    if (isCustom) {
      const rate = r.user.customWageRate || 0;
      if (otM > 0 && otH > 0) {
        estimatedOtPay = Math.round(otM * otH * rate);
      } else if (otH > 0) {
        estimatedOtPay = Math.round(otH * rate * (r.machinesOperated || 1));
      }
    } else {
      const dailyRate = r.user.dailyWage || 1000;
      if (otH > 0) {
        estimatedOtPay = Math.round(otH * (dailyRate / 12));
      }
    }

    const currentStatus = r.overtimeStatus || 'PENDING';

    if (currentStatus === 'PENDING') {
      totalPendingCount += 1;
      totalPendingAmount += estimatedOtPay;
    } else if (currentStatus === 'APPROVED') {
      totalApprovedCount += 1;
      totalApprovedAmount += estimatedOtPay;
    } else if (currentStatus === 'REJECTED') {
      totalRejectedCount += 1;
    }

    return {
      id: r.id,
      userId: r.userId,
      workerId: r.workerId,
      workerName: r.user.name,
      phone: r.user.phone,
      departmentName: r.user.department?.name || 'Textile Looms',
      unit: r.user.unit || 'Unit 1',
      attendanceDate: r.attendanceDate,
      shiftType: r.shiftType || 'DAY',
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      checkInTime: formatKolkataTime(r.checkInAt),
      checkOutTime: formatKolkataTime(r.checkOutAt),
      workingMinutes: r.workingMinutes,
      workingHours: Number((r.workingMinutes / 60).toFixed(1)),
      machinesOperated: r.machinesOperated,
      hoursOperated: r.hoursOperated,
      overtimeMachines: otM,
      overtimeHours: otH,
      overtimeStatus: currentStatus,
      overtimeApprovedAt: r.overtimeApprovedAt,
      overtimeApprovedBy: r.overtimeApprovedBy,
      overtimeRejectionReason: r.overtimeRejectionReason,
      estimatedOtPay,
      wageType: isCustom ? 'CUSTOM' : 'FIXED',
      customWageRate: r.user.customWageRate,
      dailyWage: r.user.dailyWage,
      remarks: r.remarks,
    };
  });

  return {
    items,
    summary: {
      totalPendingCount,
      totalPendingAmount,
      totalApprovedCount,
      totalApprovedAmount,
      totalRejectedCount,
      totalCount: records.length,
    },
  };
}

/**
 * Approve worker overtime request
 */
export async function approveOvertime(
  recordId: string,
  adminActor: { id: string; name: string }
) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    include: { user: true },
  });

  if (!record) {
    throw new Error('Attendance record not found.');
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      overtimeStatus: 'APPROVED',
      overtimeApprovedAt: new Date(),
      overtimeApprovedBy: adminActor.name,
      overtimeRejectionReason: null,
    },
    include: { user: true },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'OVERTIME_APPROVED',
    entityType: 'ATTENDANCE',
    entityId: recordId,
    reason: `Admin ${adminActor.name} approved overtime work for ${record.user.name} (${record.workerId})`,
    details: {
      workerId: record.workerId,
      attendanceDate: record.attendanceDate,
      overtimeMachines: record.overtimeMachines,
      overtimeHours: record.overtimeHours,
      approvedBy: adminActor.name,
    },
  });

  return updated;
}

/**
 * Reject worker overtime request
 */
export async function rejectOvertime(
  recordId: string,
  adminActor: { id: string; name: string },
  reason?: string
) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { id: recordId },
    include: { user: true },
  });

  if (!record) {
    throw new Error('Attendance record not found.');
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: {
      overtimeStatus: 'REJECTED',
      overtimeApprovedAt: new Date(),
      overtimeApprovedBy: adminActor.name,
      overtimeRejectionReason: reason || 'Overtime not approved by supervisor/admin',
    },
    include: { user: true },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'OVERTIME_REJECTED',
    entityType: 'ATTENDANCE',
    entityId: recordId,
    reason: reason || `Admin ${adminActor.name} rejected overtime work`,
    details: {
      workerId: record.workerId,
      attendanceDate: record.attendanceDate,
      overtimeMachines: record.overtimeMachines,
      overtimeHours: record.overtimeHours,
      rejectedBy: adminActor.name,
      rejectionReason: reason,
    },
  });

  return updated;
}

/**
 * Bulk approve overtime requests
 */
export async function bulkApproveOvertime(
  recordIds: string[],
  adminActor: { id: string; name: string }
) {
  if (!recordIds || recordIds.length === 0) return { count: 0 };

  const result = await prisma.attendanceRecord.updateMany({
    where: {
      id: { in: recordIds },
      overtimeStatus: 'PENDING',
    },
    data: {
      overtimeStatus: 'APPROVED',
      overtimeApprovedAt: new Date(),
      overtimeApprovedBy: adminActor.name,
    },
  });

  await logAudit({
    actorUserId: adminActor.id,
    actorName: adminActor.name,
    action: 'BULK_OVERTIME_APPROVED',
    entityType: 'ATTENDANCE',
    entityId: 'BATCH',
    reason: `Admin ${adminActor.name} bulk approved ${result.count} overtime requests`,
    details: { recordIds, approvedCount: result.count },
  });

  return result;
}
