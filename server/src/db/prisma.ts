import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

function resolveDatabaseUrl(): string {
  let url = process.env.DATABASE_URL;

  // If explicitly provided custom Postgres or external URL
  if (url && !url.includes('dev.db')) {
    if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
      if (!url.includes('connection_limit=')) {
        const sep = url.includes('?') ? '&' : '?';
        url = `${url}${sep}connection_limit=15&pool_timeout=20`;
      }
    }
    return url;
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

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: activeDbUrl,
      },
    },
    log: ['error'],
  });

globalForPrisma.prisma = prisma;

let isDbInitialized = false;

export async function ensureDatabaseReady() {
  if (isDbInitialized) return;
  try {
    // Check if company settings already exist
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

    // Ensure Owner Vinayak Ginde exists as SUPER_ADMIN
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
          role: 'SUPER_ADMIN',
          dailyWage: null,
          isActive: true,
        },
      });
      console.log('✅ Created Super Admin Vinayak Ginde account.');
    } else if (vinayak.role !== 'SUPER_ADMIN') {
      await prisma.user.update({
        where: { id: vinayak.id },
        data: { role: 'SUPER_ADMIN' },
      });
      console.log('✅ Updated Vinayak Ginde to SUPER_ADMIN.');
    }

    // Ensure company standard Day and Night shifts exist (8:00 AM - 8:00 PM and 8:00 PM - 8:00 AM)
    await prisma.shift.upsert({
      where: { name: 'Day Shift (8:00 AM - 8:00 PM)' },
      update: {
        startTime: '08:00',
        endTime: '20:00',
        gracePeriodMinutes: 15,
        breakDurationMinutes: 60,
        halfDayThresholdHours: 6.0,
        fullDayThresholdHours: 12.0,
        isActive: true,
      },
      create: {
        name: 'Day Shift (8:00 AM - 8:00 PM)',
        startTime: '08:00',
        endTime: '20:00',
        gracePeriodMinutes: 15,
        breakDurationMinutes: 60,
        halfDayThresholdHours: 6.0,
        fullDayThresholdHours: 12.0,
        isActive: true,
      },
    });

    await prisma.shift.upsert({
      where: { name: 'Night Shift (8:00 PM - 8:00 AM)' },
      update: {
        startTime: '20:00',
        endTime: '08:00',
        gracePeriodMinutes: 15,
        breakDurationMinutes: 60,
        halfDayThresholdHours: 6.0,
        fullDayThresholdHours: 12.0,
        isActive: true,
      },
      create: {
        name: 'Night Shift (8:00 PM - 8:00 AM)',
        startTime: '20:00',
        endTime: '08:00',
        gracePeriodMinutes: 15,
        breakDurationMinutes: 60,
        halfDayThresholdHours: 6.0,
        fullDayThresholdHours: 12.0,
        isActive: true,
      },
    });

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
    isDbInitialized = true;
  } catch (error) {
    console.error('ensureDatabaseReady warning:', error);
  }
}

export async function connectDatabase() {
  await ensureDatabaseReady();
  console.log('✅ Connected to database successfully.');
}
