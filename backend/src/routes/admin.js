import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { projectInclude, taskCounts, toClientProject } from '../utils/project.js';

const prisma = new PrismaClient();
const router = Router();

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

router.get('/stats', async (_req, res, next) => {
  try {
    const [users, projects, tasks, completed, usersThisMonth, projectsThisMonth, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.task.count({ where: { status: 'DONE' } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart() } } }),
      prisma.project.count({ where: { createdAt: { gte: monthStart() } } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true }
      })
    ]);
    res.json({
      users,
      projects,
      tasks,
      completed,
      completedPct: tasks ? Math.round((completed / tasks) * 100) : 0,
      usersThisMonth,
      projectsThisMonth,
      recentUsers
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = 20;
    const search = String(req.query.search || '').trim();
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
      : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * take,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { projects: true } },
          projects: { include: { groups: { include: { tasks: true } }, tasks: true } }
        }
      })
    ]);
    res.json({
      page,
      total,
      pages: Math.ceil(total / take),
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        projectsCount: user._count.projects,
        tasksCount: user.projects.reduce((sum, project) => sum + taskCounts(project).total, 0)
      }))
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { projects: { include: projectInclude, orderBy: { updatedAt: 'desc' } } }
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      projects: user.projects.map((project) => ({ ...toClientProject(project), stats: taskCounts(project) }))
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const data = {};
    if (typeof req.body.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim();
    if (typeof req.body.email === 'string' && req.body.email.trim()) data.email = req.body.email.trim().toLowerCase();
    if (req.body.role === 'USER' || req.body.role === 'ADMIN') data.role = req.body.role;
    if (typeof req.body.password === 'string' && req.body.password.length >= 8) {
      data.password = await bcrypt.hash(req.body.password, 12);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true }
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
