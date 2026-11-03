import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing all worker records to make database 100% fresh...');

  // 1. Delete all attendance records
  const att = await prisma.attendanceRecord.deleteMany({});
  console.log(`Deleted ${att.count} attendance records.`);

  // 2. Delete worker shift allocations
  const ws = await prisma.workerShift.deleteMany({});
  console.log(`Deleted ${ws.count} worker shift allocations.`);

  // 3. Delete all workers (all non-admin users)
  const users = await prisma.user.deleteMany({
    where: {
      OR: [
        { role: 'WORKER' },
        { workerId: { not: 'VINAYAK4501' } },
      ],
    },
  });
  console.log(`Deleted ${users.count} worker profiles.`);

  // 4. Ensure Admin account VINAYAK4501 is active and clean
  const adminPasswordHash = await bcrypt.hash('swami@4501', 10);
  const admin = await prisma.user.upsert({
    where: { workerId: 'VINAYAK4501' },
    update: {
      name: 'Vinayak Ginde',
      role: 'ADMIN',
      isActive: true,
      passwordHash: adminPasswordHash,
    },
    create: {
      workerId: 'VINAYAK4501',
      name: 'Vinayak Ginde',
      role: 'ADMIN',
      phone: '+91 98220 45010',
      isActive: true,
      passwordHash: adminPasswordHash,
    },
  });
  console.log(`Admin account verified: ${admin.workerId} (${admin.name})`);

  // 5. Ensure standard departments exist
  const departmentsData = [
    { name: 'Weaving', description: 'Power loom & automatic shuttleless loom weaving operations' },
    { name: 'Jacquard', description: 'Intricate pattern fabric & jacquard weaving division' },
    { name: 'Spinning', description: 'Raw fiber carding, drawing, roving, and yarn ring spinning' },
    { name: 'Dyeing & Printing', description: 'Yarn and fabric bleaching, dyeing, and rotary printing' },
    { name: 'Quality Control', description: 'GSM checking, defect grading, and yarn strength testing' },
    { name: 'Maintenance & Utility', description: 'Looms repair, boiler maintenance, and electrical support' },
  ];
  for (const dept of departmentsData) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: dept,
    });
  }
  console.log('Departments verified.');

  // 6. Ensure shifts exist
  const shiftsData = [
    {
      name: 'General Shift (8:30 AM - 5:30 PM)',
      startTime: '08:30',
      endTime: '17:30',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 60,
      halfDayThresholdHours: 4.0,
      fullDayThresholdHours: 8.0,
    },
    {
      name: 'Day Shift (7:00 AM - 3:30 PM)',
      startTime: '07:00',
      endTime: '15:30',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 30,
      halfDayThresholdHours: 4.0,
      fullDayThresholdHours: 8.0,
    },
    {
      name: 'Night Shift (7:00 PM - 3:30 AM)',
      startTime: '19:00',
      endTime: '03:30',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 30,
      halfDayThresholdHours: 4.0,
      fullDayThresholdHours: 8.0,
    },
  ];
  for (const s of shiftsData) {
    await prisma.shift.upsert({
      where: { name: s.name },
      update: s,
      create: s,
    });
  }
  console.log('Shifts verified.');

  const remainingUsers = await prisma.user.count();
  const remainingAtt = await prisma.attendanceRecord.count();
  console.log('==============================================');
  console.log(`STATUS: FRESH`);
  console.log(`Total remaining users: ${remainingUsers} (Admin VINAYAK4501 only)`);
  console.log(`Total remaining attendance records: ${remainingAtt}`);
  console.log('==============================================');
}

main()
  .catch((e) => {
    console.error('Error clearing workers:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
