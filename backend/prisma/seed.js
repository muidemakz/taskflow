import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fortnoto = JSON.parse(fs.readFileSync(path.join(__dirname, 'fortnotoSeed.json'), 'utf8'));

function status(value) {
  return String(value).toLowerCase() === 'done' ? 'DONE' : 'TODO';
}

function priority(value) {
  const normalized = String(value || 'NONE').toUpperCase();
  return ['NONE', 'LOW', 'MID', 'HIGH'].includes(normalized) ? normalized : 'NONE';
}

function dateOrNull(value) {
  return value ? new Date(value) : null;
}

async function upsertUser({ email, name, password, role }) {
  const hashed = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, password: hashed, role },
    create: { email, name, password: hashed, role }
  });
}

async function seedFortnoto(ownerId) {
  const existing = await prisma.project.findFirst({ where: { ownerId, title: fortnoto.name } });
  if (existing) {
    console.log('Fortnoto demo project already exists. Skipping project seed.');
    return;
  }

  const project = await prisma.project.create({
    data: {
      title: fortnoto.name,
      description: 'Demo project seeded from the original Fortnoto checklist artifact.',
      ownerId,
      shareEnabled: true,
      order: []
    }
  });

  const taskIdMap = new Map();
  const groupIdMap = new Map();

  for (const task of fortnoto.tasks || []) {
    const created = await prisma.task.create({
      data: {
        title: task.title,
        status: status(task.status),
        priority: priority(task.priority),
        comment: task.comment || null,
        completedAt: dateOrNull(task.completedAt),
        projectId: project.id
      }
    });
    taskIdMap.set(task.id, created.id);
  }

  for (const group of fortnoto.groups || []) {
    const createdGroup = await prisma.group.create({
      data: { title: group.title, projectId: project.id }
    });
    groupIdMap.set(group.id, createdGroup.id);
    for (const task of group.tasks || []) {
      const createdTask = await prisma.task.create({
        data: {
          title: task.title,
          status: status(task.status),
          priority: priority(task.priority),
          comment: task.comment || null,
          completedAt: dateOrNull(task.completedAt),
          projectId: project.id,
          groupId: createdGroup.id
        }
      });
      taskIdMap.set(task.id, createdTask.id);
    }
  }

  const order = (fortnoto.order || [])
    .map((key) => {
      const [type, oldId] = key.split(':');
      if (type === 'task') return `task:${taskIdMap.get(oldId)}`;
      if (type === 'group') return `group:${groupIdMap.get(oldId)}`;
      return null;
    })
    .filter(Boolean);

  await prisma.project.update({ where: { id: project.id }, data: { order } });
}

async function main() {
  const admin = await upsertUser({
    email: 'admin@taskflow.app',
    name: 'Taskflow Admin',
    password: 'Admin1234!',
    role: 'ADMIN'
  });
  const demo = await upsertUser({
    email: 'demo@taskflow.app',
    name: 'Demo User',
    password: 'Demo1234!',
    role: 'USER'
  });

  await prisma.refreshToken.deleteMany({ where: { userId: { in: [admin.id, demo.id] } } });
  await seedFortnoto(demo.id);
  console.log('Seeded Taskflow admin, demo user, and Fortnoto project.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
