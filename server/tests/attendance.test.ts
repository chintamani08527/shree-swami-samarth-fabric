import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { processCheckIn, processCheckOut } from '../src/services/attendance.service.js';
import { getKolkataDateString } from '../src/utils/time.js';

describe('Attendance Logic & Restrictions', () => {
  const todayStr = getKolkataDateString(new Date());

  it('should prevent duplicate check-in if worker already checked in today', async () => {
    // Pandurang Shinde (SSF-101) was checked in today during seeding
    const user = await prisma.user.findUnique({ where: { workerId: 'SSF-101' } });
    expect(user).toBeDefined();

    await expect(processCheckIn(user!.id)).rejects.toThrow(/Attendance already recorded: Checked in at/);
  });

  it('should allow a worker who has not checked in today to check in', async () => {
    // Sunil Jadhav (SSF-106)
    const user = await prisma.user.findUnique({ where: { workerId: 'SSF-106' } });
    expect(user).toBeDefined();

    // Ensure clean state for SSF-106 today
    await prisma.attendanceRecord.deleteMany({
      where: { userId: user!.id, attendanceDate: todayStr },
    });

    const res = await processCheckIn(user!.id);
    expect(res).toBeDefined();
    expect(res.record.checkInAt).toBeDefined();
    expect(res.record.status).toBeDefined();

    // Now immediate second check-in attempt should be rejected
    await expect(processCheckIn(user!.id)).rejects.toThrow(/Attendance already recorded/);
  });

  it('should allow checkout after check-in and record working hours', async () => {
    const user = await prisma.user.findUnique({ where: { workerId: 'SSF-106' } });
    expect(user).toBeDefined();

    const outRes = await processCheckOut(user!.id);
    expect(outRes).toBeDefined();
    expect(outRes.record.checkOutAt).toBeDefined();
    expect(outRes.workingHours).toBeGreaterThanOrEqual(0);

    // Attempting another checkout should be prevented
    await expect(processCheckOut(user!.id)).rejects.toThrow(/Check-out already completed/);
  });

  it('should prevent checkout if worker has no active check-in', async () => {
    // Balu Mane (SSF-110) has no check-in today
    const user = await prisma.user.findUnique({ where: { workerId: 'SSF-110' } });
    expect(user).toBeDefined();

    await prisma.attendanceRecord.deleteMany({
      where: { userId: user!.id, attendanceDate: todayStr },
    });

    await expect(processCheckOut(user!.id)).rejects.toThrow(/No active check-in found for today/);
  });
});
