import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { generatePatToken, hashPatToken } from '../lib/pat.js';

const router = Router();

function serializeToken(t) {
  return { id: t.id, label: t.label, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt, revokedAt: t.revokedAt };
}

router.get('/', async (req, res, next) => {
  try {
    const tokens = await prisma.personalAccessToken.findMany({
      where: { userId: req.auth.sub },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tokens.map(serializeToken));
  } catch (error) {
    next(error);
  }
});

// The plaintext token is returned exactly once, here. Only its hash is
// ever stored.
router.post('/', async (req, res, next) => {
  try {
    const label = req.body.label?.trim();
    if (!label) return res.status(400).json({ message: 'Token label is required' });
    const token = generatePatToken();
    const created = await prisma.personalAccessToken.create({
      data: { userId: req.auth.sub, label, tokenHash: hashPatToken(token) }
    });
    res.status(201).json({ ...serializeToken(created), token });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const token = await prisma.personalAccessToken.findFirst({ where: { id: req.params.id, userId: req.auth.sub } });
    if (!token) return res.status(404).json({ message: 'Token not found' });
    await prisma.personalAccessToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
