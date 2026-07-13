import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

const DEFAULT_STATUSES = [
  { name: 'Backlog', order: 0, countsAsDone: false },
  { name: 'To-do', order: 1, countsAsDone: false },
  { name: 'In progress', order: 2, countsAsDone: false },
  { name: 'In review', order: 3, countsAsDone: false },
  { name: 'Done', order: 4, countsAsDone: true }
];

function orderArray(project) {
  return Array.isArray(project.order) ? project.order : [];
}

// Mirrors frontend/src/utils/project.js's orderedEntries(): walk
// Project.order, expanding group keys into that group's tasks (in
// createdAt order, matching current GroupCard rendering), falling back to
// createdAt order for anything not present in the order array.
function flattenVisualTaskOrder(project) {
  const rootTasks = new Map(project.tasks.map((t) => [`task:${t.id}`, t]));
  const groupsByKey = new Map(project.groups.map((g) => [`group:${g.id}`, g]));
  const placed = new Set();
  const flat = [];

  for (const key of orderArray(project)) {
    if (rootTasks.has(key)) {
      const task = rootTasks.get(key);
      flat.push(task);
      placed.add(task.id);
    } else if (groupsByKey.has(key)) {
      const group = groupsByKey.get(key);
      for (const task of group.tasks) {
        flat.push(task);
        placed.add(task.id);
      }
    }
  }

  // Anything not covered by the order array (defensive fallback), in
  // createdAt order -- root tasks first, then remaining grouped tasks.
  const leftoverRoot = project.tasks.filter((t) => !placed.has(t.id));
  const leftoverGrouped = project.groups.flatMap((g) => g.tasks.filter((t) => !placed.has(t.id)));
  const leftover = [...leftoverRoot, ...leftoverGrouped].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
  flat.push(...leftover);

  return flat;
}

async function migrateProject(project) {
  console.log(`\n--- Project ${project.id} (${project.title}) ---`);

  // 1. Seed the 5 default Statuses for this project (idempotent: skip if
  // this project already has Statuses, e.g. a re-run).
  let statuses = await prisma.status.findMany({ where: { projectId: project.id } });
  if (statuses.length === 0) {
    await prisma.status.createMany({
      data: DEFAULT_STATUSES.map((s) => ({ ...s, projectId: project.id }))
    });
    statuses = await prisma.status.findMany({ where: { projectId: project.id } });
    console.log(`  created ${statuses.length} default statuses`);
  } else {
    console.log(`  statuses already exist (${statuses.length}), reusing`);
  }
  const firstNonDoneStatus = statuses.filter((s) => !s.countsAsDone).sort((a, b) => a.order - b.order)[0];
  const doneStatus = statuses.find((s) => s.countsAsDone);
  if (!firstNonDoneStatus || !doneStatus) {
    throw new Error(`Project ${project.id}: could not resolve TODO/DONE target statuses`);
  }

  // 2. Groups -> Tags, every task in a group gets that tag.
  const tagIdByGroupId = new Map();
  for (const group of project.groups) {
    const tag = await prisma.tag.upsert({
      where: { projectId_name: { projectId: project.id, name: group.title } },
      update: {},
      create: { projectId: project.id, name: group.title }
    });
    tagIdByGroupId.set(group.id, tag.id);
  }
  if (project.groups.length) {
    await prisma.taskTag.createMany({
      data: project.groups.flatMap((group) =>
        group.tasks.map((task) => ({ taskId: task.id, tagId: tagIdByGroupId.get(group.id) }))
      ),
      skipDuplicates: true
    });
    console.log(`  ${project.groups.length} groups -> tags, ${project.groups.reduce((n, g) => n + g.tasks.length, 0)} task-tag links`);
  }

  // 3. statusId + position, scoped per status column, derived from the
  // flattened current visual order.
  const visualOrder = flattenVisualTaskOrder(project);
  const positionCounters = new Map();
  const POSITION_STEP = 1000;

  for (const task of visualOrder) {
    const targetStatus = task.status === 'DONE' ? doneStatus : firstNonDoneStatus;
    const nextPosition = (positionCounters.get(targetStatus.id) || 0) + POSITION_STEP;
    positionCounters.set(targetStatus.id, nextPosition);

    await prisma.task.update({
      where: { id: task.id },
      data: { statusId: targetStatus.id, position: nextPosition }
    });
  }
  console.log(`  ${visualOrder.length} tasks assigned statusId + position`);

  // 4. hasRoadmap = false (already the schema default, set explicitly for
  // clarity/idempotency).
  await prisma.project.update({ where: { id: project.id }, data: { hasRoadmap: false } });
}

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      groups: {
        include: { tasks: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'asc' }
      },
      tasks: { where: { groupId: null }, orderBy: { createdAt: 'asc' } }
    }
  });
  console.log(`Found ${projects.length} project(s) to migrate.`);
  for (const project of projects) {
    await migrateProject(project);
  }
  console.log('\nBackfill complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
