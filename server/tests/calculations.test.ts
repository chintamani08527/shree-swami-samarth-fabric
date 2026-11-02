import { describe, it, expect } from 'vitest';
import { calculateWorkingHoursAndStatus, ShiftInfo } from '../src/utils/time.js';

describe('Attendance Working Hours & Status Calculations', () => {
  const standardShift: ShiftInfo = {
    startTime: '08:30',
    endTime: '17:30',
    gracePeriodMinutes: 15,
    breakDurationMinutes: 60,
    halfDayThresholdHours: 4.0,
    fullDayThresholdHours: 8.0,
  };

  it('should calculate standard full day attendance with 60 min break deduction', () => {
    // 08:25 AM to 05:30 PM (9 hours 5 mins total = 545 mins)
    // 545 - 60 min break = 485 working minutes = 8.08 hours
    const checkIn = new Date('2026-11-02T02:55:00.000Z'); // 8:25 AM IST (UTC+5:30)
    const checkOut = new Date('2026-11-02T12:00:00.000Z'); // 5:30 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, standardShift, '2026-11-02');

    expect(result.status).toBe('PRESENT');
    expect(result.breakMinutes).toBe(60);
    expect(result.workingHours).toBeGreaterThanOrEqual(8.0);
    expect(result.lateMinutes).toBe(0);
    expect(result.isMissingCheckOut).toBe(false);
  });

  it('should flag late arrival when check-in exceeds shift start + grace period', () => {
    // Shift starts 08:30, grace period 15 mins -> 08:45 AM
    // Check-in at 08:50 AM -> 20 minutes late compared to 08:30
    // Check-out at 05:50 PM (9 hours = 540 mins - 60 break = 480 mins = 8.0 hrs full day)
    const checkIn = new Date('2026-11-02T03:20:00.000Z'); // 08:50 AM IST
    const checkOut = new Date('2026-11-02T12:20:00.000Z'); // 05:50 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, standardShift, '2026-11-02');

    expect(result.status).toBe('LATE');
    expect(result.lateMinutes).toBe(20);
    expect(result.workingHours).toBe(8.0);
    expect(result.breakMinutes).toBe(60);
  });

  it('should assign HALF_DAY status when working hours are between 4.0 and 8.0 hours', () => {
    // Check-in 08:30 AM, Check-out 01:30 PM (5 hours = 300 mins)
    // 300 - 60 break = 240 mins = 4.0 hours
    const checkIn = new Date('2026-11-02T03:00:00.000Z'); // 08:30 AM IST
    const checkOut = new Date('2026-11-02T08:00:00.000Z'); // 01:30 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, standardShift, '2026-11-02');

    expect(result.status).toBe('HALF_DAY');
    expect(result.workingHours).toBe(4.0);
  });

  it('should calculate overtime when working hours exceed regular shift hours', () => {
    // Worker stays late until 07:30 PM (11 hours total = 660 mins)
    // 660 - 60 break = 600 working mins = 10 hours
    // Expected 8 hours (480 mins) -> 120 mins overtime
    const checkIn = new Date('2026-11-02T03:00:00.000Z'); // 08:30 AM IST
    const checkOut = new Date('2026-11-02T14:00:00.000Z'); // 07:30 PM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, standardShift, '2026-11-02');

    expect(result.status).toBe('PRESENT');
    expect(result.workingHours).toBe(10);
    expect(result.overtimeMinutes).toBe(120);
  });

  it('should not deduct break when total time is under the auto-deduction threshold', () => {
    // 2 hours worked (120 mins < 300 min threshold)
    const checkIn = new Date('2026-11-02T03:00:00.000Z'); // 08:30 AM IST
    const checkOut = new Date('2026-11-02T05:00:00.000Z'); // 10:30 AM IST

    const result = calculateWorkingHoursAndStatus(checkIn, checkOut, standardShift, '2026-11-02');

    expect(result.breakMinutes).toBe(0);
    expect(result.workingHours).toBe(2.0);
  });
});
