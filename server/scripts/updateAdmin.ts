import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating Admin user to Vinayak Ginde (vinayak4501)...');

  const passwordHash = await bcrypt.hash('swami@4501', 10);

  // Remove old ADM-001 if present
  await prisma.user.deleteMany({
    where: { workerId: 'ADM-001' },
  });

  // Upsert Vinayak Ginde as sole Admin
  const admin = await prisma.user.upsert({
    where: { workerId: 'VINAYAK4501' },
    update: {
      name: 'Vinayak Ginde (admin)',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      workerId: 'VINAYAK4501',
      name: 'Vinayak Ginde (admin)',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      phone: '+91 98220 45010',
    },
  });

  // Update audit log for initialization
  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      actorName: 'Vinayak Ginde (admin)',
      action: 'ADMIN_SETUP',
      entityType: 'SETTINGS',
      reason: 'Configured owner Vinayak Ginde as primary system administrator',
      details: JSON.stringify({ workerId: 'VINAYAK4501', owner: 'Vinayak Ginde' }),
    },
  });

  console.log('✅ Admin successfully set to Vinayak Ginde (vinayak4501)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
