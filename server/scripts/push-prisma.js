import { execSync } from 'child_process';
import process from 'process';

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
const schema = isPostgres ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma';

console.log(`[Prisma Push] Using schema: ${schema} (Postgres: ${isPostgres})`);
const cmd = process.platform === 'win32'
  ? `npx.cmd prisma db push --schema=${schema}`
  : `npx prisma db push --schema=${schema}`;

execSync(cmd, { stdio: 'inherit' });
