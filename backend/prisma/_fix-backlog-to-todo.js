import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const prisma = new PrismaClient();

// One-time data fix: the initial backfill mapped legacy TODO -> "first
// non-done Status" (Backlog), per a literal reading of the migration spec.
// This moves that batch to "To-do" instead. Position values are kept
// as-is: To-do had zero tasks before this ran, so there's no collision and
// the existing relative ordering among the moved batch is preserved
// automatically.
async function main() {
  const backlog = await prisma.status.findMany({ where: { name: 'Backlog' } });
  for (const status of backlog) {
    const todo = await prisma.status.findFirst({ where: { projectId: status.projectId, name: 'To-do' } });
    if (!todo) {
      console.log(`  project ${status.projectId}: no "To-do" status found, skipping`);
      continue;
    }
    const result = await prisma.task.updateMany({
      where: { statusId: status.id },
      data: { statusId: todo.id }
    });
    console.log(`  project ${status.projectId}: moved ${result.count} tasks from Backlog -> To-do`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
