import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, prisma } from './db/prisma.js';

async function bootstrap() {
  await connectDatabase();

  // Ensure singleton CompanySettings exists
  const settings = await prisma.companySettings.findUnique({
    where: { id: 'default-settings' },
  });

  if (!settings) {
    await prisma.companySettings.create({
      data: {
        id: 'default-settings',
        companyName: config.companyName,
        timezone: config.companyTimezone,
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
    console.log('⚡ Initialized default Company Settings.');
  }

  app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Shree Swami Samarth Fabric Attendance System Backend`);
    console.log(`🌐 Server running at: http://localhost:${config.port}`);
    console.log(`🏭 Company: ${config.companyName}`);
    console.log(`⏰ Timezone: ${config.companyTimezone}`);
    console.log(`=======================================================`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
