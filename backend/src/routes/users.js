import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { publicUser } from '../utils/token.js';

const router = Router();
const THEMES = ['LIGHT', 'DARK', 'SYSTEM'];
// Generous cap for a client-resized avatar data: URL -- well under the 1mb
// express.json limit, but enough to reject anything that skipped resizing.
const MAX_AVATAR_LENGTH = 300_000;

router.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

router.patch('/me', async (req, res, next) => {
  try {
    const data = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ message: 'Name cannot be empty' });
      data.name = name;
    }
    if (req.body.theme !== undefined) {
      if (!THEMES.includes(req.body.theme)) return res.status(400).json({ message: 'Invalid theme' });
      data.theme = req.body.theme;
    }
    if (req.body.avatarUrl !== undefined) {
      if (req.body.avatarUrl !== null && req.body.avatarUrl.length > MAX_AVATAR_LENGTH) {
        return res.status(400).json({ message: 'Avatar image is too large' });
      }
      data.avatarUrl = req.body.avatarUrl;
    }
    const user = await prisma.user.update({ where: { id: req.auth.sub }, data });
    res.json(publicUser(user));
  } catch (error) {
    next(error);
  }
});

// Self-service, available to every authenticated user regardless of role --
// both require the current password so a stolen short-lived access token
// alone isn't enough to take over the account.

router.patch('/me/email', async (req, res, next) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const currentPassword = req.body.currentPassword;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });

    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    if (email === user.email) return res.json(publicUser(user));

    const updated = await prisma.user.update({ where: { id: user.id }, data: { email } });
    res.json(publicUser(updated));
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'Email is already in use' });
    next(error);
  }
});

router.patch('/me/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ message: '8+ character new password is required' });

    const user = await prisma.user.findUnique({ where: { id: req.auth.sub } });
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { password: hashed } }),
      // Password change signs out every other session -- standard practice
      // in case the change was prompted by a compromised account.
      prisma.refreshToken.deleteMany({ where: { userId: user.id } })
    ]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
