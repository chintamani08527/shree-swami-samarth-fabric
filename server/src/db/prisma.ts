import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

function resolveDatabaseUrl(): string {
  // If explicitly provided custom Postgres or external URL
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('dev.db')) {
    return process.env.DATABASE_URL;
  }

  // On Vercel serverless environment (/tmp is the only writable directory)
  if (process.env.VERCEL) {
    const tmpDb = '/tmp/dev.db';
    if (!fs.existsSync(tmpDb)) {
      const candidates = [
        path.resolve(process.cwd(), 'server/prisma/dev.db'),
        path.resolve(process.cwd(), 'prisma/dev.db'),
        path.resolve(process.cwd(), 'dev.db'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          try {
            fs.copyFileSync(candidate, tmpDb);
            console.log(`Copied SQLite database from ${candidate} to ${tmpDb}`);
            break;
          } catch (e) {
            console.error('Error copying sqlite db to /tmp:', e);
          }
        }
      }
    }
    return `file:${tmpDb}`;
  }

  // Local environment
  return process.env.DATABASE_URL || 'file:./dev.db';
}

const activeDbUrl = resolveDatabaseUrl();
process.env.DATABASE_URL = activeDbUrl;

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: activeDbUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function ensureDatabaseReady() {
  try {
    await prisma.$connect();

    // Ensure company settings exist
    const settings = await prisma.companySettings.findUnique({
      where: { id: 'default-settings' },
    });
    if (!settings) {
      await prisma.companySettings.create({
        data: {
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
      console.log('✅ Created default Company Settings.');
    }

    // Ensure Owner Vinayak Ginde exists
    const vinayak = await prisma.user.findFirst({
      where: { workerId: 'VINAYAK4501' },
    });
    if (!vinayak) {
      const hash = await bcrypt.hash('swami@4501', 10);
      await prisma.user.create({
        data: {
          workerId: 'VINAYAK4501',
          name: 'Vinayak Ginde',
          phone: '+91 98220 45010',
          passwordHash: hash,
          role: 'ADMIN',
          dailyWage: null,
          isActive: true,
        },
      });
      console.log('✅ Created Owner Vinayak Ginde account.');
    }

    // Ensure default shifts exist
    const defaultShift = await prisma.shift.findFirst();
    if (!defaultShift) {
      await prisma.shift.createMany({
        data: [
          {
            name: 'General Shift (8:30 AM - 5:30 PM)',
            startTime: '08:30',
            endTime: '17:30',
            gracePeriodMinutes: 15,
            breakDurationMinutes: 60,
            halfDayThresholdHours: 4.0,
            fullDayThresholdHours: 8.0,
            isActive: true,
          },
          {
            name: 'Day Shift (7:00 AM - 3:30 PM)',
            startTime: '07:00',
            endTime: '15:30',
            gracePeriodMinutes: 15,
            breakDurationMinutes: 30,
            halfDayThresholdHours: 4.0,
            fullDayThresholdHours: 8.0,
            isActive: true,
          },
          {
            name: 'Night Shift (7:00 PM - 3:30 AM)',
            startTime: '19:00',
            endTime: '03:30',
            gracePeriodMinutes: 15,
            breakDurationMinutes: 30,
            halfDayThresholdHours: 4.0,
            fullDayThresholdHours: 8.0,
            isActive: true,
          },
        ],
      });
      console.log('✅ Created default Shifts.');
    }

    // Ensure default departments exist
    const defaultDept = await prisma.department.findFirst();
    if (!defaultDept) {
      await prisma.department.createMany({
        data: [
          { name: 'Weaving', description: 'Power loom & automatic shuttleless loom weaving operations', isActive: true },
          { name: 'Jacquard', description: 'Intricate pattern fabric & jacquard weaving division', isActive: true },
          { name: 'Spinning', description: 'Raw fiber carding, drawing, roving, and yarn ring spinning', isActive: true },
          { name: 'Dyeing & Printing', description: 'Yarn and fabric bleaching, dyeing, and rotary printing', isActive: true },
          { name: 'Quality Control', description: 'GSM checking, defect grading, and yarn strength testing', isActive: true },
          { name: 'Maintenance & Utility', description: 'Looms repair, boiler maintenance, and electrical support', isActive: true },
        ],
      });
      console.log('✅ Created default Departments.');
    }
  } catch (error) {
    console.error('ensureDatabaseReady warning:', error);
  }
}

export async function connectDatabase() {
  await ensureDatabaseReady();
  console.log('✅ Connected to database successfully.');
}
