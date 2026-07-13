import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const prisma = new PrismaClient();

async function main() {
  const counts = {
    User: await prisma.user.count(),
    RefreshToken: await prisma.refreshToken.count(),
    Project: await prisma.project.count(),
    Group: await prisma.group.count(),
    Task: await prisma.task.count(),
    Status: await prisma.status.count(),
    Tag: await prisma.tag.count(),
    TaskTag: await prisma.taskTag.count(),
    Roadmap: await prisma.roadmap.count(),
    Gate: await prisma.gate.count()
  };
  console.log('=== Row counts ===');
  console.log(JSON.stringify(counts, null, 2));

  const nullStatusId = await prisma.task.count({ where: { statusId: null } });
  const nullPosition = await prisma.task.count({ where: { position: null } });
  console.log(`\ntasks with NULL statusId: ${nullStatusId} (should be 0)`);
  console.log(`tasks with NULL position: ${nullPosition} (should be 0)`);

  // Status<->old-status-enum consistency check
  const mismatched = await prisma.$queryRawUnsafe(`
    SELECT t.id, t.status AS old_status, s.name AS new_status_name, s."countsAsDone"
    FROM "Task" t
    JOIN "Status" s ON s.id = t."statusId"
    WHERE (t.status = 'DONE' AND s."countsAsDone" = false)
       OR (t.status = 'TODO' AND s."countsAsDone" = true)
  `);
  console.log(`\nold-status/new-status mismatches: ${mismatched.length} (should be 0)`);

  // Ordering spot-check: reconstruct the original visual order for the
  // Fortnoto project and compare its first/last 8 task titles against the
  // order implied by (statusId, position) after migration.
  const project = await prisma.project.findFirst({
    include: {
      groups: { include: { tasks: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'asc' } },
      tasks: { where: { groupId: null }, orderBy: { createdAt: 'asc' } }
    }
  });

  const rootTasks = new Map(project.tasks.map((t) => [`task:${t.id}`, t]));
  const groupsByKey = new Map(project.groups.map((g) => [`group:${g.id}`, g]));
  const originalVisualOrder = [];
  for (const key of project.order) {
    if (rootTasks.has(key)) originalVisualOrder.push(rootTasks.get(key));
    else if (groupsByKey.has(key)) originalVisualOrder.push(...groupsByKey.get(key).tasks);
  }

  const migratedOrder = await prisma.task.findMany({
    where: { projectId: project.id },
    orderBy: [{ statusId: 'asc' }, { position: 'asc' }]
  });
  // Compare within-status relative order only, since original order mixed
  // TODO/DONE together but the new model splits them into columns.
  const statuses = await prisma.status.findMany({ where: { projectId: project.id } });
  const doneStatusId = statuses.find((s) => s.countsAsDone).id;

  const originalDoneTitles = originalVisualOrder.filter((t) => t.status === 'DONE').map((t) => t.title);
  const migratedDoneTitles = migratedOrder.filter((t) => t.statusId === doneStatusId).map((t) => t.title);
  const originalTodoTitles = originalVisualOrder.filter((t) => t.status === 'TODO').map((t) => t.title);
  const migratedTodoTitles = migratedOrder.filter((t) => t.statusId !== doneStatusId).map((t) => t.title);

  console.log('\n=== Ordering spot-check (DONE column) ===');
  console.log('original first 8:', JSON.stringify(originalDoneTitles.slice(0, 8)));
  console.log('migrated first 8:', JSON.stringify(migratedDoneTitles.slice(0, 8)));
  console.log('DONE arrays identical:', JSON.stringify(originalDoneTitles) === JSON.stringify(migratedDoneTitles));

  console.log('\n=== Ordering spot-check (TODO/non-done column) ===');
  console.log('original first 8:', JSON.stringify(originalTodoTitles.slice(0, 8)));
  console.log('migrated first 8:', JSON.stringify(migratedTodoTitles.slice(0, 8)));
  console.log('TODO arrays identical:', JSON.stringify(originalTodoTitles) === JSON.stringify(migratedTodoTitles));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
