import { describe, it, expect } from 'vitest';
import { calculateWorkingHoursAndStatus, ShiftInfo } from '../src/utils/time.js';

describe('Attendance Working Hours & Status Calculations', () => {
  const dayShift: ShiftInfo = {
    startTime: '08:00',
    endTime: '20:00',
    gracePeriodMinutes: 60,
    breakDurationMinutes: 60,
    halfDayThresholdHours: 4.0,
    fullDayThresholdHours: 8.0,
  };

  const nightShift: ShiftInfo = {
    startTime: '20:00',
    endTime: '08:00',
    gracePeriodMinutes: 60,
    breakDurationMinutes: 60,
    halfDayThresholdHours: 4.0,
    fullDayThresholdHours: 8.0,
  };

  it('should mark PRESENT when morning check-in is at or before 9:00 AM', () => {
    // 08:45 AM IST (UTC+5:30 -> 03:15 UTC) to 08:00 PM IST (14:30 UTC)
    const checkIn = new Date('2026-11-02T03:15:00.000Z'); // 8:45 AM IST
    const checkOut = new Date('2026-11-02T14:30:00.000Z'); // 8:00 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, dayShift, '2026-11-02');

    expect(result.status).toBe('PRESENT');
    expect(result.lateMinutes).toBe(0);
    expect(result.workingHours).toBeGreaterThanOrEqual(8.0);
  });

  it('should flag LATE when morning check-in is after 9:00 AM', () => {
    // 09:15 AM IST (03:45 UTC) to 08:00 PM IST (14:30 UTC)
    const checkIn = new Date('2026-11-02T03:45:00.000Z'); // 9:15 AM IST
    const checkOut = new Date('2026-11-02T14:30:00.000Z'); // 8:00 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, dayShift, '2026-11-02');

    expect(result.status).toBe('LATE');
    expect(result.lateMinutes).toBe(75); // 75 minutes past 8:00 AM shift start
  });

  it('should mark PRESENT when evening check-in is at or before 9:00 PM (21:00)', () => {
    // 08:50 PM IST (15:20 UTC) to 08:00 AM IST next day (02:30 UTC)
    const checkIn = new Date('2026-11-02T15:20:00.000Z'); // 8:50 PM IST
    const checkOut = new Date('2026-11-03T02:30:00.000Z'); // 8:00 AM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, nightShift, '2026-11-02');

    expect(result.status).toBe('PRESENT');
    expect(result.lateMinutes).toBe(0);
  });

  it('should flag LATE when evening check-in is after 9:00 PM (21:00)', () => {
    // 09:15 PM IST (15:45 UTC) to 08:00 AM IST next day (02:30 UTC)
    const checkIn = new Date('2026-11-02T15:45:00.000Z'); // 9:15 PM IST
    const checkOut = new Date('2026-11-03T02:30:00.000Z'); // 8:00 AM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, nightShift, '2026-11-02');

    expect(result.status).toBe('LATE');
    expect(result.lateMinutes).toBe(75); // 75 minutes past 8:00 PM shift start
  });

  it('should assign HALF_DAY status when working hours are between 4.0 and 8.0 hours on time', () => {
    // Check-in 08:00 AM, Check-out 01:30 PM (5.5 hours = 330 mins - 60 break = 270 mins = 4.5 hours)
    const checkIn = new Date('2026-11-02T02:30:00.000Z'); // 08:00 AM IST
    const checkOut = new Date('2026-11-02T08:00:00.000Z'); // 01:30 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, dayShift, '2026-11-02');

    expect(result.status).toBe('HALF_DAY');
    expect(result.workingHours).toBe(4.5);
  });

  it('should calculate overtime when working hours exceed regular shift hours', () => {
    // 08:00 AM to 09:00 PM (13 hours = 780 mins - 60 break = 720 mins = 12 hours)
    const checkIn = new Date('2026-11-02T02:30:00.000Z'); // 08:00 AM IST
    const checkOut = new Date('2026-11-02T15:30:00.000Z'); // 09:00 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, dayShift, '2026-11-02');

    expect(result.status).toBe('PRESENT');
    expect(result.workingHours).toBe(12.0);
    expect(result.overtimeMinutes).toBeGreaterThan(0);
  });
});
