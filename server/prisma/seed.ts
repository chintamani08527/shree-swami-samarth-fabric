import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TIMEZONE = 'Asia/Kolkata';

async function main() {
  console.log('🌱 Starting database seeding for Shree Swami Samarth Fabric...');

  // 1. Company Settings
  await prisma.companySettings.upsert({
    where: { id: 'default-settings' },
    update: {},
    create: {
      id: 'default-settings',
      companyName: 'Shree Swami Samarth Fabric',
      timezone: TIMEZONE,
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
  console.log('✅ Company Settings seeded.');

  // 2. Departments
  const departmentsData = [
    { name: 'Weaving', description: 'Power loom & automatic shuttleless loom weaving operations' },
    { name: 'Jacquard', description: 'Intricate pattern fabric & jacquard weaving division' },
    { name: 'Spinning', description: 'Raw fiber carding, drawing, roving, and yarn ring spinning' },
    { name: 'Dyeing & Printing', description: 'Yarn and fabric bleaching, dyeing, and rotary printing' },
    { name: 'Quality Control', description: 'GSM checking, defect grading, and yarn strength testing' },
    { name: 'Maintenance & Utility', description: 'Looms repair, boiler maintenance, and electrical support' },
  ];

  const deptMap = new Map<string, any>();
  for (const dept of departmentsData) {
    const created = await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: dept,
    });
    deptMap.set(dept.name, created);
  }
  console.log(`✅ Seeded ${deptMap.size} departments.`);

  // 3. Shifts (Day: 8:00 AM - 8:00 PM, Night: 8:00 PM - 8:00 AM)
  const shiftsData = [
    {
      name: 'Day Shift (8:00 AM - 8:00 PM)',
      startTime: '08:00',
      endTime: '20:00',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 60,
      halfDayThresholdHours: 6.0,
      fullDayThresholdHours: 12.0,
    },
    {
      name: 'Night Shift (8:00 PM - 8:00 AM)',
      startTime: '20:00',
      endTime: '08:00',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 60,
      halfDayThresholdHours: 6.0,
      fullDayThresholdHours: 12.0,
    },
  ];

  for (const s of shiftsData) {
    await prisma.shift.upsert({
      where: { name: s.name },
      update: s,
      create: s,
    });
  }
  console.log(`✅ Seeded ${shiftsData.length} shifts.`);

  // 4. Admin User (Owner & Primary Administrator)
  const adminPasswordHash = await bcrypt.hash('swami@4501', 10);
  const adminUser = await prisma.user.upsert({
    where: { workerId: 'VINAYAK4501' },
    update: {
      name: 'Vinayak Ginde',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    create: {
      workerId: 'VINAYAK4501',
      name: 'Vinayak Ginde',
      phone: '+91 98220 45010',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true,
      departmentId: deptMap.get('Maintenance & Utility')?.id,
    },
  });
  console.log('✅ Admin Owner account seeded: VINAYAK4501 / swami@4501');

  // 5. Initial Audit Log
  const existingInitLog = await prisma.auditLog.findFirst({
    where: { action: 'SYSTEM_INITIALIZATION' },
  });
  if (!existingInitLog) {
    await prisma.auditLog.create({
      data: {
        actorUserId: adminUser.id,
        actorName: adminUser.name,
        action: 'SYSTEM_INITIALIZATION',
        entityType: 'SETTINGS',
        reason: 'Fresh production setup of Shree Swami Samarth Fabric Attendance System',
        details: JSON.stringify({ version: '1.0.0', shifts: shiftsData.length, departments: departmentsData.length }),
      },
    });
    console.log('✅ Initial Audit log created.');
  }

  console.log('=======================================================');
  console.log('🎉 Fresh database setup completed successfully!');
  console.log('Factory Owner (Admin): Worker ID: VINAYAK4501 | Password: swami@4501 (Vinayak Ginde)');
  console.log('Workers: 0 (Ready for fresh registration via Admin portal)');
  console.log('=======================================================');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
