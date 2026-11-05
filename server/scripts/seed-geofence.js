import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const current = await prisma.companySettings.findUnique({
    where: { id: 'default-settings' },
  });

  let rules = {};
  if (current?.attendanceRules) {
    try {
      rules = JSON.parse(current.attendanceRules);
    } catch {}
  }

  const updatedRules = {
    ...rules,
    geofencingEnabled: true,
    geofenceRadiusMeters: 400,
    unit1Name: 'Unit 1',
    unit1Lat: 16.432500,
    unit1Lng: 74.384222,
    unit2Name: 'Unit 2',
    unit2Lat: 16.344861,
    unit2Lng: 74.441361,
  };

  const updated = await prisma.companySettings.upsert({
    where: { id: 'default-settings' },
    update: {
      attendanceRules: JSON.stringify(updatedRules),
    },
    create: {
      id: 'default-settings',
      companyName: 'Shree Swami Samarth Fabric',
      timezone: 'Asia/Kolkata',
      defaultWorkingHours: 8.0,
      attendanceRules: JSON.stringify(updatedRules),
    },
  });

  console.log('✅ Successfully updated geofence settings in database:', updatedRules);
}

main()
  .catch((e) => {
    console.error('Error seeding geofence:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
