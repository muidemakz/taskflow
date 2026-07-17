import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import prisma from '../lib/prisma.js';
import { projectInclude, taskCounts, toClientProject } from '../utils/project.js';
import { logAdminActivity } from '../lib/adminActivity.js';

const router = Router();
const INVITE_TTL_DAYS = 7;

function inviteUrlFor(token) {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontend.replace(/\/$/, '')}/invite/${token}`;
}

function serializeInvite(invite) {
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    inviteUrl: inviteUrlFor(invite.token)
  };
}

// Refuses to remove ADMIN from the last remaining admin -- without this,
// an admin editing their own role (or another admin's) could accidentally
// lock every admin out of the panel with no way back in short of a direct
// DB fix.
async function wouldRemoveLastAdmin(userId, newRole) {
  if (newRole !== 'USER') return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== 'ADMIN') return false;
  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  return adminCount <= 1;
}

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
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'User not found' });

    const data = {};
    const activityEntries = [];
    const actorId = req.auth.sub;

    if (typeof req.body.name === 'string' && req.body.name.trim()) data.name = req.body.name.trim();

    if (typeof req.body.email === 'string' && req.body.email.trim()) {
      const email = req.body.email.trim().toLowerCase();
      if (email !== existing.email) {
        data.email = email;
        activityEntries.push({ actorId, targetUserId: existing.id, eventType: 'user_email_changed', oldValue: existing.email, newValue: email });
      }
    }

    if (req.body.role === 'USER' || req.body.role === 'ADMIN') {
      if (req.body.role !== existing.role) {
        if (await wouldRemoveLastAdmin(existing.id, req.body.role)) {
          return res.status(400).json({ message: 'Cannot remove admin role from the last remaining admin' });
        }
        data.role = req.body.role;
        activityEntries.push({ actorId, targetUserId: existing.id, eventType: 'user_role_changed', oldValue: existing.role, newValue: req.body.role });
      }
    }

    if (typeof req.body.password === 'string' && req.body.password.length >= 8) {
      data.password = await bcrypt.hash(req.body.password, 12);
      activityEntries.push({ actorId, targetUserId: existing.id, eventType: 'user_password_reset', oldValue: null, newValue: null });
    }

    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: existing.id },
        data,
        select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true }
      });
      if (activityEntries.length) await tx.adminActivity.createMany({ data: activityEntries });
      return updated;
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'User not found' });
    if (existing.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) return res.status(400).json({ message: 'Cannot delete the last remaining admin' });
    }
    await logAdminActivity(prisma, {
      actorId: req.auth.sub, targetUserId: null, eventType: 'user_deleted',
      oldValue: existing.email, newValue: null
    });
    await prisma.user.delete({ where: { id: existing.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// --- Admin activity log ---

router.get('/activity', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const take = 30;
    const [total, entries] = await Promise.all([
      prisma.adminActivity.count(),
      prisma.adminActivity.findMany({
        skip: (page - 1) * take,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, name: true, email: true } },
          targetUser: { select: { id: true, name: true, email: true } }
        }
      })
    ]);
    res.json({ page, total, pages: Math.ceil(total / take), entries });
  } catch (error) {
    next(error);
  }
});

// --- Invites (no email sending -- the URL is a copyable one-time link,
// same UX as the PAT plaintext reveal) ---

router.get('/invites', async (req, res, next) => {
  try {
    const invites = await prisma.userInvite.findMany({
      where: { acceptedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { invitedBy: { select: { name: true } } }
    });
    res.json(invites.map((i) => ({ ...serializeInvite(i), invitedByName: i.invitedBy.name })));
  } catch (error) {
    next(error);
  }
});

router.post('/invites', async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const role = req.body.role === 'ADMIN' ? 'ADMIN' : 'USER';

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(409).json({ message: 'A user with this email already exists' });

    const existingInvite = await prisma.userInvite.findFirst({ where: { email, acceptedAt: null } });
    if (existingInvite) return res.status(409).json({ message: 'A pending invite for this email already exists' });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.$transaction(async (tx) => {
      const created = await tx.userInvite.create({
        data: { email, role, token, expiresAt, invitedById: req.auth.sub },
        include: { invitedBy: { select: { name: true } } }
      });
      await logAdminActivity(tx, { actorId: req.auth.sub, targetUserId: null, eventType: 'user_invited', oldValue: null, newValue: `${email} (${role})` });
      return created;
    });

    res.status(201).json({ ...serializeInvite(invite), invitedByName: invite.invitedBy.name });
  } catch (error) {
    next(error);
  }
});

router.delete('/invites/:id', async (req, res, next) => {
  try {
    const invite = await prisma.userInvite.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.acceptedAt) return res.status(404).json({ message: 'Invite not found' });
    await prisma.$transaction(async (tx) => {
      await tx.userInvite.delete({ where: { id: invite.id } });
      await logAdminActivity(tx, { actorId: req.auth.sub, targetUserId: null, eventType: 'user_invite_revoked', oldValue: invite.email, newValue: null });
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
