import { Router } from 'express';
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

export default router;
