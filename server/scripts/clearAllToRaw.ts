import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all mock data to raw initial state...');

  // 1. Delete all attendance records
  const deletedAttendance = await prisma.attendanceRecord.deleteMany({});
  console.log(`Deleted ${deletedAttendance.count} attendance records.`);

  // 2. Delete all worker shift allocations
  const deletedShifts = await prisma.workerShift.deleteMany({});
  console.log(`Deleted ${deletedShifts.count} worker shift assignments.`);

  // 3. Delete all audit logs
  const deletedAudit = await prisma.auditLog.deleteMany({});
  console.log(`Deleted ${deletedAudit.count} audit logs.`);

  // 4. Delete all users except VINAYAK4501
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      workerId: { not: 'VINAYAK4501' },
    },
  });
  console.log(`Deleted ${deletedUsers.count} worker/supervisor profiles.`);

  // 5. Delete all departments so the user can add their own
  const deletedDepts = await prisma.department.deleteMany({});
  console.log(`Deleted ${deletedDepts.count} mock departments.`);

  // 6. Ensure Vinayak Ginde (Owner & Sole Admin) is pristine
  const passwordHash = await bcrypt.hash('swami@4501', 10);
  const admin = await prisma.user.upsert({
    where: { workerId: 'VINAYAK4501' },
    update: {
      name: 'Vinayak Ginde',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      departmentId: null,
    },
    create: {
      workerId: 'VINAYAK4501',
      name: 'Vinayak Ginde',
      phone: null,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      departmentId: null,
    },
  });

  // 7. Ensure clean CompanySettings
  await prisma.companySettings.upsert({
    where: { id: 'default-settings' },
    update: {
      companyName: 'Shree Swami Samarth Fabric',
      timezone: 'Asia/Kolkata',
      defaultWorkingHours: 8.0,
    },
    create: {
      id: 'default-settings',
      companyName: 'Shree Swami Samarth Fabric',
      timezone: 'Asia/Kolkata',
      defaultWorkingHours: 8.0,
      attendanceRules: JSON.stringify({
        gracePeriodMinutes: 15,
        breakDurationMinutes: 60,
        autoDeductBreakThresholdMinutes: 300,
        halfDayThresholdHours: 4.0,
        fullDayThresholdHours: 8.0,
        overtimeThresholdHours: 8.5,
        dailyCutoffTime: '23:59',
      }),
    },
  });

  console.log('=======================================================');
  console.log('✅ DATABASE IS NOW RAW & CLEAN!');
  console.log('Only 1 user exists:');
  console.log(`  Admin: Vinayak Ginde (admin) | Worker ID: vinayak4501 | Password: swami@4501`);
  console.log('All mock workers, departments, wages, and attendance records have been cleared.');
  console.log('=======================================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
