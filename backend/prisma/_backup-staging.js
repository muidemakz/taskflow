import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const outDir = process.argv[2] || './backup';

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const tables = {
    User: () => prisma.user.findMany(),
    RefreshToken: () => prisma.refreshToken.findMany(),
    Project: () => prisma.project.findMany(),
    Group: () => prisma.group.findMany(),
    Task: () => prisma.task.findMany()
  };

  const counts = {};
  for (const [name, fetch] of Object.entries(tables)) {
    const rows = await fetch();
    counts[name] = rows.length;
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(rows, null, 2));
    console.log(`${name}: ${rows.length} rows -> ${outDir}/${name}.json`);
  }

  fs.writeFileSync(path.join(outDir, '_counts.json'), JSON.stringify(counts, null, 2));
  console.log('\nBackup complete:', JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
