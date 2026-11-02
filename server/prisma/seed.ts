import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { format, subDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

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

  // 3. Shifts
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
      name: 'Shift A - Morning (7:00 AM - 3:30 PM)',
      startTime: '07:00',
      endTime: '15:30',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 30,
      halfDayThresholdHours: 4.0,
      fullDayThresholdHours: 8.0,
    },
    {
      name: 'Shift B - Evening (3:30 PM - 12:00 AM)',
      startTime: '15:30',
      endTime: '00:00',
      gracePeriodMinutes: 15,
      breakDurationMinutes: 30,
      halfDayThresholdHours: 4.0,
      fullDayThresholdHours: 8.0,
    },
  ];

  const shiftMap = new Map<string, any>();
  for (const s of shiftsData) {
    const created = await prisma.shift.upsert({
      where: { name: s.name },
      update: s,
      create: s,
    });
    shiftMap.set(s.name, created);
  }
  const generalShift = shiftMap.get('General Shift (8:30 AM - 5:30 PM)');
  const morningShift = shiftMap.get('Shift A - Morning (7:00 AM - 3:30 PM)');
  console.log(`✅ Seeded ${shiftMap.size} shifts.`);

  // Passwords
  const adminPasswordHash = await bcrypt.hash('swami@4501', 10);
  const supervisorPasswordHash = await bcrypt.hash('super123', 10);
  const defaultWorkerPinHash = await bcrypt.hash('1234', 10);

  // 4. Admin User (Owner & Primary Administrator)
  const adminUser = await prisma.user.upsert({
    where: { workerId: 'VINAYAK4501' },
    update: {
      name: 'Vinayak Ginde (admin)',
      passwordHash: adminPasswordHash,
    },
    create: {
      workerId: 'VINAYAK4501',
      name: 'Vinayak Ginde (admin)',
      phone: '+91 98220 45010',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      isActive: true,
      departmentId: deptMap.get('Maintenance & Utility')?.id,
    },
  });

  // 5. Supervisor User
  const supervisorUser = await prisma.user.upsert({
    where: { workerId: 'SUP-001' },
    update: {},
    create: {
      workerId: 'SUP-001',
      name: 'Suresh Deshmukh',
      phone: '+91 98220 54321',
      passwordHash: supervisorPasswordHash,
      role: 'SUPERVISOR',
      isActive: true,
      departmentId: deptMap.get('Weaving')?.id,
    },
  });
  console.log('✅ Admin & Supervisor accounts seeded.');

  // 6. Realistic Factory Workers
  const workersSeedList = [
    { workerId: 'SSF-101', name: 'Pandurang Shinde', phone: '+91 94211 11001', dept: 'Weaving', pin: '1001' },
    { workerId: 'SSF-102', name: 'Ananda More', phone: '+91 94211 11002', dept: 'Jacquard', pin: '1002' },
    { workerId: 'SSF-103', name: 'Dattatray Kadam', phone: '+91 94211 11003', dept: 'Weaving', pin: '1003' },
    { workerId: 'SSF-104', name: 'Santosh Gaikwad', phone: '+91 94211 11004', dept: 'Spinning', pin: '1004' },
    { workerId: 'SSF-105', name: 'Vikas Chavan', phone: '+91 94211 11005', dept: 'Dyeing & Printing', pin: '1005' },
    { workerId: 'SSF-106', name: 'Sunil Jadhav', phone: '+91 94211 11006', dept: 'Quality Control', pin: '1006' },
    { workerId: 'SSF-107', name: 'Prakash Salunkhe', phone: '+91 94211 11007', dept: 'Jacquard', pin: '1007' },
    { workerId: 'SSF-108', name: 'Mahadev Pawar', phone: '+91 94211 11008', dept: 'Maintenance & Utility', pin: '1008' },
    { workerId: 'SSF-109', name: 'Ganesh Bhosale', phone: '+91 94211 11009', dept: 'Weaving', pin: '1009' },
    { workerId: 'SSF-110', name: 'Balu Mane', phone: '+91 94211 11010', dept: 'Spinning', pin: '1010' },
  ];

  const createdWorkers: any[] = [];
  for (const w of workersSeedList) {
    const pinHash = await bcrypt.hash(w.pin, 10);
    const worker = await prisma.user.upsert({
      where: { workerId: w.workerId },
      update: { name: w.name, phone: w.phone },
      create: {
        workerId: w.workerId,
        name: w.name,
        phone: w.phone,
        passwordHash: pinHash,
        role: 'WORKER',
        isActive: true,
        departmentId: deptMap.get(w.dept)?.id,
        joiningDate: new Date('2024-01-15'),
      },
    });

    // Assign General Shift
    const existingShift = await prisma.workerShift.findFirst({
      where: { userId: worker.id, effectiveTo: null },
    });
    if (!existingShift && generalShift) {
      await prisma.workerShift.create({
        data: {
          userId: worker.id,
          shiftId: generalShift.id,
          effectiveFrom: new Date('2024-01-15'),
        },
      });
    }

    createdWorkers.push(worker);
  }
  console.log(`✅ Seeded ${createdWorkers.length} factory workers.`);

  // 7. Generate Attendance History for Past 6 Days + Today
  const todayZoned = toZonedTime(new Date(), TIMEZONE);
  const todayStr = format(todayZoned, 'yyyy-MM-dd');

  for (let dayOffset = 6; dayOffset >= 1; dayOffset--) {
    const pastDate = subDays(todayZoned, dayOffset);
    const dateStr = format(pastDate, 'yyyy-MM-dd');

    for (let i = 0; i < createdWorkers.length; i++) {
      const worker = createdWorkers[i];

      // Simulate realistic attendance pattern:
      // Most present, 1 late, 1 absent occasionally
      if (i === 9 && dayOffset % 3 === 0) {
        // Balu Mane absent on some days
        continue;
      }

      const isLate = i === 3 && dayOffset % 2 === 1; // Santosh late sometimes
      const checkInHour = isLate ? 8 : 8;
      const checkInMin = isLate ? 52 : Math.floor(15 + Math.random() * 14); // 8:15 to 8:29 AM or 8:52 AM
      const checkOutHour = 17;
      const checkOutMin = Math.floor(30 + Math.random() * 25); // 5:30 to 5:55 PM

      const [y, m, d] = dateStr.split('-').map(Number);
      // Kolkate is UTC+5:30
      const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
      const checkInUtc = new Date(Date.UTC(y, m - 1, d, checkInHour, checkInMin, 0) - kolkataOffsetMs);
      const checkOutUtc = new Date(Date.UTC(y, m - 1, d, checkOutHour, checkOutMin, 0) - kolkataOffsetMs);

      const elapsedMinutes = Math.round((checkOutUtc.getTime() - checkInUtc.getTime()) / (60 * 1000));
      const breakMinutes = 60;
      const workingMinutes = elapsedMinutes - breakMinutes;
      const lateMinutes = isLate ? 22 : 0;
      const overtimeMinutes = Math.max(0, workingMinutes - 480);

      await prisma.attendanceRecord.upsert({
        where: {
          userId_attendanceDate: {
            userId: worker.id,
            attendanceDate: dateStr,
          },
        },
        update: {},
        create: {
          userId: worker.id,
          workerId: worker.workerId,
          attendanceDate: dateStr,
          checkInAt: checkInUtc,
          checkOutAt: checkOutUtc,
          status: isLate ? 'LATE' : 'PRESENT',
          source: 'WEB_MOBILE',
          workingMinutes,
          breakMinutes,
          overtimeMinutes,
          lateMinutes,
          isMissingCheckOut: false,
          remarks: isLate ? 'Slightly delayed due to bus delay' : null,
        },
      });
    }
  }

  // 8. Today's live records
  // Let's create realistic status for today:
  // - 5 workers currently checked in (live active duration!)
  // - 2 workers checked in & checked out (completed work)
  // - 1 checked in late
  // - 2 not checked in yet (so dashboard has real diversity)
  const [y, m, d] = todayStr.split('-').map(Number);
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;

  // Worker 0: Pandurang Shinde - Currently Checked In (8:20 AM)
  const inUtc1 = new Date(Date.UTC(y, m - 1, d, 8, 20, 0) - kolkataOffsetMs);
  await prisma.attendanceRecord.upsert({
    where: { userId_attendanceDate: { userId: createdWorkers[0].id, attendanceDate: todayStr } },
    update: {},
    create: {
      userId: createdWorkers[0].id,
      workerId: createdWorkers[0].workerId,
      attendanceDate: todayStr,
      checkInAt: inUtc1,
      checkOutAt: null, // Currently checked in!
      status: 'PRESENT',
      source: 'WEB_MOBILE',
      workingMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
    },
  });

  // Worker 1: Ananda More - Currently Checked In (8:25 AM)
  const inUtc2 = new Date(Date.UTC(y, m - 1, d, 8, 25, 0) - kolkataOffsetMs);
  await prisma.attendanceRecord.upsert({
    where: { userId_attendanceDate: { userId: createdWorkers[1].id, attendanceDate: todayStr } },
    update: {},
    create: {
      userId: createdWorkers[1].id,
      workerId: createdWorkers[1].workerId,
      attendanceDate: todayStr,
      checkInAt: inUtc2,
      checkOutAt: null, // Currently checked in!
      status: 'PRESENT',
      source: 'WEB_MOBILE',
      workingMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
    },
  });

  // Worker 2: Dattatray Kadam - Checked In Late (8:55 AM) & Currently Checked In
  const inUtc3 = new Date(Date.UTC(y, m - 1, d, 8, 55, 0) - kolkataOffsetMs);
  await prisma.attendanceRecord.upsert({
    where: { userId_attendanceDate: { userId: createdWorkers[2].id, attendanceDate: todayStr } },
    update: {},
    create: {
      userId: createdWorkers[2].id,
      workerId: createdWorkers[2].workerId,
      attendanceDate: todayStr,
      checkInAt: inUtc3,
      checkOutAt: null, // Currently checked in!
      status: 'LATE',
      source: 'WEB_MOBILE',
      workingMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 25,
      remarks: 'Traffic on factory approach road',
    },
  });

  // Worker 3: Santosh Gaikwad - Early Morning Shift Completed (07:00 AM to 03:30 PM)
  const inUtc4 = new Date(Date.UTC(y, m - 1, d, 7, 0, 0) - kolkataOffsetMs);
  const outUtc4 = new Date(Date.UTC(y, m - 1, d, 15, 30, 0) - kolkataOffsetMs);
  await prisma.attendanceRecord.upsert({
    where: { userId_attendanceDate: { userId: createdWorkers[3].id, attendanceDate: todayStr } },
    update: {},
    create: {
      userId: createdWorkers[3].id,
      workerId: createdWorkers[3].workerId,
      attendanceDate: todayStr,
      checkInAt: inUtc4,
      checkOutAt: outUtc4,
      status: 'PRESENT',
      source: 'WEB_MOBILE',
      workingMinutes: 480,
      breakMinutes: 30,
      overtimeMinutes: 0,
      lateMinutes: 0,
    },
  });

  // Worker 4: Vikas Chavan - Currently Checked In (8:10 AM)
  const inUtc5 = new Date(Date.UTC(y, m - 1, d, 8, 10, 0) - kolkataOffsetMs);
  await prisma.attendanceRecord.upsert({
    where: { userId_attendanceDate: { userId: createdWorkers[4].id, attendanceDate: todayStr } },
    update: {},
    create: {
      userId: createdWorkers[4].id,
      workerId: createdWorkers[4].workerId,
      attendanceDate: todayStr,
      checkInAt: inUtc5,
      checkOutAt: null, // Currently checked in!
      status: 'PRESENT',
      source: 'WEB_MOBILE',
      workingMinutes: 0,
      breakMinutes: 0,
      overtimeMinutes: 0,
      lateMinutes: 0,
    },
  });

  // 9. Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: adminUser.id,
        actorName: adminUser.name,
        action: 'SYSTEM_INITIALIZATION',
        entityType: 'SETTINGS',
        reason: 'Initial setup of Shree Swami Samarth Fabric Attendance System',
        details: JSON.stringify({ version: '1.0.0', shifts: shiftsData.length }),
      },
      {
        actorUserId: adminUser.id,
        actorName: adminUser.name,
        action: 'DEPARTMENT_CREATED',
        entityType: 'DEPARTMENT',
        reason: 'Configured textile manufacturing departments: Weaving, Jacquard, Spinning, Dyeing',
        details: JSON.stringify({ count: departmentsData.length }),
      },
      {
        actorUserId: adminUser.id,
        actorName: adminUser.name,
        action: 'WORKER_REGISTERED',
        entityType: 'WORKER',
        reason: 'Registered 10 production floor textile technicians & operators',
        details: JSON.stringify({ count: createdWorkers.length }),
      },
    ],
  });

  console.log('✅ Audit logs seeded.');
  console.log('=======================================================');
  console.log('🎉 Seeding successfully completed!');
  console.log('Credentials to test:');
  console.log('  Admin (Owner): Worker ID: vinayak4501 | Password: swami@4501 (Vinayak Ginde)');
  console.log('  Supervisor:    Worker ID: SUP-001 | Password: super123');
  console.log('  Worker:     Worker ID: SSF-101 | PIN: 1001 (Pandurang Shinde)');
  console.log('  Worker:     Worker ID: SSF-102 | PIN: 1002 (Ananda More)');
  console.log('  Worker:     Worker ID: SSF-106 | PIN: 1006 (Sunil Jadhav - Not Checked In Yet)');
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
