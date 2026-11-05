import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateShiftLatePolicy() {
  console.log('🔄 Updating database shifts to 9:00 AM & 9:00 PM late cutoff (60 min grace)...');

  // 1. Update Day Shift
  const dayShift = await prisma.shift.updateMany({
    where: {
      OR: [
        { name: { contains: 'Day' } },
        { startTime: '08:00' }
      ]
    },
    data: {
      gracePeriodMinutes: 60,
      halfDayThresholdHours: 4.0,
      fullDayThresholdHours: 8.0,
    }
  });
  console.log(`✅ Updated ${dayShift.count} Day shift(s) to 60 min grace (late after 9:00 AM).`);

  // 2. Update Night Shift
  const nightShift = await prisma.shift.updateMany({
    where: {
      OR: [
        { name: { contains: 'Night' } },
        { startTime: '20:00' }
      ]
    },
    data: {
      gracePeriodMinutes: 60,
      halfDayThresholdHours: 4.0,
      fullDayThresholdHours: 8.0,
    }
  });
  console.log(`✅ Updated ${nightShift.count} Night shift(s) to 60 min grace (late after 9:00 PM).`);

  // 3. Update Company Settings
  const settings = await prisma.companySettings.findUnique({
    where: { id: 'default-settings' }
  });

  if (settings) {
    let rules = {};
    try {
      rules = JSON.parse(settings.attendanceRules);
    } catch {}

    rules.gracePeriodMinutes = 60;
    rules.morningLateCutoff = '09:00';
    rules.eveningLateCutoff = '21:00';

    await prisma.companySettings.update({
      where: { id: 'default-settings' },
      data: {
        attendanceRules: JSON.stringify(rules)
      }
    });
    console.log('✅ Updated Company Settings attendanceRules with morning (09:00) and evening (21:00) late mark rules.');
  }

  // 4. Verify all shifts
  const allShifts = await prisma.shift.findMany();
  console.log('📋 All active shifts in database:');
  allShifts.forEach(s => {
    console.log(`   - ${s.name}: start ${s.startTime}, grace ${s.gracePeriodMinutes}m (Late if check-in > ${s.startTime === '08:00' ? '09:00 AM' : '09:00 PM'})`);
  });

  await prisma.$disconnect();
  console.log('🎉 Done!');
}

updateShiftLatePolicy().catch(err => {
  console.error('Error updating shift policy:', err);
  process.exit(1);
});
