import { toZonedTime, format } from 'date-fns-tz';
import {
  addDays,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
} from 'date-fns';
import { config, DEFAULT_ATTENDANCE_RULES, AttendanceStatuses, AttendanceStatusType } from '../config/index.js';

const TIMEZONE = config.companyTimezone;

/**
 * Returns current date string in Asia/Kolkata timezone (YYYY-MM-DD)
 */
export function getKolkataDateString(date: Date = new Date()): string {
  const zoned = toZonedTime(date, TIMEZONE);
  return format(zoned, 'yyyy-MM-dd', { timeZone: TIMEZONE });
}

/**
 * Formats a Date object to time string in Asia/Kolkata (e.g. "08:30 AM")
 */
export function formatKolkataTime(date: Date | null | undefined): string {
  if (!date) return '--:--';
  const zoned = toZonedTime(date, TIMEZONE);
  return format(zoned, 'hh:mm a', { timeZone: TIMEZONE });
}

/**
 * Formats a Date or date string to readable date in Asia/Kolkata (e.g. "02 Nov 2026")
 */
export function formatKolkataDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  const zoned = toZonedTime(d, TIMEZONE);
  return format(zoned, 'dd MMM yyyy', { timeZone: TIMEZONE });
}

/**
 * Formats full date and time in Asia/Kolkata (e.g. "02 Nov 2026, 08:30 AM")
 */
export function formatKolkataDateTime(date: Date | null | undefined): string {
  if (!date) return '';
  const zoned = toZonedTime(date, TIMEZONE);
  return format(zoned, 'dd MMM yyyy, hh:mm a', { timeZone: TIMEZONE });
}

/**
 * Get Day of Week name (e.g. "Monday")
 */
export function getDayOfWeekName(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const zoned = toZonedTime(d, TIMEZONE);
  return format(zoned, 'EEEE', { timeZone: TIMEZONE });
}

/**
 * Parses "HH:mm" string on a given date into a Date object in Kolkata timezone
 */
export function parseKolkataTimeString(timeStr: string, dateStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dateParts = dateStr.split('-').map(Number);
  // Construct date in UTC offset for Kolkata (+05:30 = 330 minutes)
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const localUtcMs = Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2], hours, minutes, 0);
  return new Date(localUtcMs - kolkataOffsetMs);
}

/**
 * Returns date range for a given week containing reference date
 */
export function getWeekDateRange(refDateStr?: string) {
  const refDate = refDateStr ? parseISO(refDateStr) : toZonedTime(new Date(), TIMEZONE);
  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 }); // Sunday

  const dates: string[] = [];
  let curr = weekStart;
  for (let i = 0; i < 7; i++) {
    dates.push(format(curr, 'yyyy-MM-dd'));
    curr = addDays(curr, 1);
  }

  return {
    startOfWeek: format(weekStart, 'yyyy-MM-dd'),
    endOfWeek: format(weekEnd, 'yyyy-MM-dd'),
    dates,
  };
}

/**
 * Returns date range and daily array for a given month containing reference date
 */
export function getMonthDateRange(refDateStr?: string) {
  const refDate = refDateStr ? parseISO(refDateStr) : toZonedTime(new Date(), TIMEZONE);
  const mStart = startOfMonth(refDate);
  const mEnd = endOfMonth(refDate);

  const dates: string[] = [];
  const days = eachDayOfInterval({ start: mStart, end: mEnd });
  for (const d of days) {
    dates.push(format(d, 'yyyy-MM-dd'));
  }

  return {
    startOfMonth: format(mStart, 'yyyy-MM-dd'),
    endOfMonth: format(mEnd, 'yyyy-MM-dd'),
    monthName: format(mStart, 'MMMM yyyy'),
    dates,
    totalDays: dates.length,
  };
}

/**
 * Returns year range and year string
 */
export function getYearDateRange(yearRef?: number | string) {
  let refDate: Date;
  if (typeof yearRef === 'number') {
    refDate = new Date(yearRef, 0, 1);
  } else if (typeof yearRef === 'string' && yearRef.length === 4) {
    refDate = new Date(parseInt(yearRef, 10), 0, 1);
  } else if (typeof yearRef === 'string') {
    refDate = parseISO(yearRef);
  } else {
    refDate = toZonedTime(new Date(), TIMEZONE);
  }

  const yStart = startOfYear(refDate);
  const yEnd = endOfYear(refDate);

  return {
    startOfYear: format(yStart, 'yyyy-MM-dd'),
    endOfYear: format(yEnd, 'yyyy-MM-dd'),
    year: format(yStart, 'yyyy'),
    yearNumber: parseInt(format(yStart, 'yyyy'), 10),
  };
}

export interface ShiftInfo {
  name?: string;
  startTime: string; // "08:30"
  endTime: string;   // "17:30"
  gracePeriodMinutes?: number;
  breakDurationMinutes?: number;
  halfDayThresholdHours?: number;
  fullDayThresholdHours?: number;
}

export interface AttendanceCalculationResult {
  workingMinutes: number;
  workingHours: number;
  breakMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  status: AttendanceStatusType;
  isMissingCheckOut: boolean;
}

/**
 * Calculate working hours, break deductions, late minutes, overtime, and attendance status
 */
export function calculateWorkingHoursAndStatus(
  checkInAt: Date,
  checkOutAt: Date | null | undefined,
  shift?: ShiftInfo | null,
  attendanceDateStr?: string,
  rules = DEFAULT_ATTENDANCE_RULES
): AttendanceCalculationResult {
  const dateStr = attendanceDateStr || getKolkataDateString(checkInAt);
  const shiftStartTime = shift?.startTime || '08:30';
  const shiftEndTime = shift?.endTime || '17:30';
  const graceMinutes = shift?.gracePeriodMinutes ?? rules.gracePeriodMinutes;
  const standardBreakMinutes = shift?.breakDurationMinutes ?? rules.breakDurationMinutes;
  const halfDayHours = shift?.halfDayThresholdHours ?? rules.halfDayThresholdHours;
  const fullDayHours = shift?.fullDayThresholdHours ?? rules.fullDayThresholdHours;

  // Calculate late arrival
  // Factory Rule: check-in after 9:00 AM in the morning or after 9:00 PM (21:00) in the evening receives a LATE mark!
  const expectedCheckInDate = parseKolkataTimeString(shiftStartTime, dateStr);

  const isNightShift = shiftStartTime.startsWith('20') || shiftStartTime.startsWith('19') || shiftStartTime.startsWith('21') || Boolean(shift?.name && shift.name.toLowerCase().includes('night'));
  const isDayShift = shiftStartTime.startsWith('08') || shiftStartTime.startsWith('07') || shiftStartTime.startsWith('09') || Boolean(shift?.name && shift.name.toLowerCase().includes('day'));

  let lateCutoffDate: Date;
  if (isNightShift) {
    // Evening Shift late cutoff: 09:00 PM (21:00 IST)
    lateCutoffDate = parseKolkataTimeString('21:00', dateStr);
  } else if (isDayShift) {
    // Morning Shift late cutoff: 09:00 AM (09:00 IST)
    lateCutoffDate = parseKolkataTimeString('09:00', dateStr);
  } else {
    // Custom / other shift: use expected start + grace minutes
    lateCutoffDate = new Date(expectedCheckInDate.getTime() + graceMinutes * 60 * 1000);
  }

  let lateMinutes = 0;
  if (checkInAt.getTime() > lateCutoffDate.getTime()) {
    lateMinutes = Math.max(1, Math.round((checkInAt.getTime() - expectedCheckInDate.getTime()) / (60 * 1000)));
  }

  // If not checked out yet:
  if (!checkOutAt) {
    const isLate = lateMinutes > 0;
    return {
      workingMinutes: 0,
      workingHours: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes,
      status: isLate ? AttendanceStatuses.LATE : AttendanceStatuses.PRESENT,
      isMissingCheckOut: false,
    };
  }

  // When checked out:
  const totalElapsedMinutes = Math.max(0, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / (60 * 1000)));

  // Break deduction rules:
  // Apply break deduction if worked more than threshold (e.g. 5 hours = 300 minutes)
  let breakMinutes = 0;
  if (totalElapsedMinutes >= rules.autoDeductBreakThresholdMinutes) {
    breakMinutes = standardBreakMinutes;
  }

  const workingMinutes = Math.max(0, totalElapsedMinutes - breakMinutes);
  const workingHours = Number((workingMinutes / 60).toFixed(2));

  // Overtime calculation:
  // Expected shift duration:
  let shiftDurationMinutes = 480; // default 8 hours
  try {
    const shiftStart = parseKolkataTimeString(shiftStartTime, dateStr);
    let shiftEnd = parseKolkataTimeString(shiftEndTime, dateStr);
    if (shiftEnd.getTime() < shiftStart.getTime()) {
      // overnight shift
      shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    const nominalMinutes = Math.round((shiftEnd.getTime() - shiftStart.getTime()) / (60 * 1000));
    shiftDurationMinutes = Math.max(0, nominalMinutes - standardBreakMinutes);
  } catch {
    shiftDurationMinutes = 480;
  }

  let overtimeMinutes = 0;
  if (workingMinutes > shiftDurationMinutes) {
    overtimeMinutes = workingMinutes - shiftDurationMinutes;
  }

  // Determine final status
  let status: AttendanceStatusType = AttendanceStatuses.PRESENT;
  if (workingHours < halfDayHours) {
    status = AttendanceStatuses.HALF_DAY;
  } else if (workingHours < fullDayHours) {
    status = lateMinutes > 0 ? AttendanceStatuses.LATE : AttendanceStatuses.HALF_DAY;
  } else {
    status = lateMinutes > 0 ? AttendanceStatuses.LATE : AttendanceStatuses.PRESENT;
  }

  return {
    workingMinutes,
    workingHours,
    breakMinutes,
    overtimeMinutes,
    lateMinutes,
    status,
    isMissingCheckOut: false,
  };
}
