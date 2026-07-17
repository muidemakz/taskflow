import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { createRefreshToken, publicUser, refreshExpiryDate, signAccessToken } from '../utils/token.js';

const router = Router();

async function issueSession(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = createRefreshToken();
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiryDate() } });
  return { user: publicUser(user), accessToken, refreshToken };
}

async function requireValidInvite(token) {
  const invite = await prisma.userInvite.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  return invite;
}

// No account details beyond email/role -- this is a public, unauthenticated
// route reachable by anyone with the link, so it deliberately reveals
// nothing about who sent the invite or when.
router.get('/:token', async (req, res, next) => {
  try {
    const invite = await requireValidInvite(req.params.token);
    if (!invite) return res.status(404).json({ message: 'Invite not found or expired' });
    res.json({ email: invite.email, role: invite.role });
  } catch (error) {
    next(error);
  }
});

router.post('/:token/accept', async (req, res, next) => {
  try {
    const invite = await requireValidInvite(req.params.token);
    if (!invite) return res.status(404).json({ message: 'Invite not found or expired' });

    const name = req.body.name?.trim();
    const password = req.body.password;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!password || password.length < 8) return res.status(400).json({ message: '8+ character password is required' });

    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) return res.status(409).json({ message: 'Email is already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email: invite.email, name, password: hashed, role: invite.role, lastLoginAt: new Date() }
      });
      await tx.userInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return created;
    });

    res.status(201).json(await issueSession(user));
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'Email is already registered' });
    next(error);
  }
});

export default router;
