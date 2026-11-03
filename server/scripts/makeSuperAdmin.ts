import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.user.updateMany({
    where: {
      OR: [
        { workerId: 'VINAYAK4501' },
        { workerId: 'vinayak4501' },
      ],
    },
    data: {
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Updated Vinayak to SUPER_ADMIN: ${updated.count} record(s).`);

  const user = await prisma.user.findFirst({
    where: { workerId: 'VINAYAK4501' },
  });
  console.log('Current Vinayak user:', user?.workerId, user?.name, user?.role);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
