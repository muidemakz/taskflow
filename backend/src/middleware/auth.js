import { verifyAccessToken } from '../utils/token.js';
import prisma from '../lib/prisma.js';
import { PAT_PREFIX, hashPatToken } from '../lib/pat.js';

// Accepts a PAT anywhere a JWT is accepted today -- downstream route code
// reads req.auth.sub the same way regardless of which auth method was
// used. v1: full-access-as-the-user scope, no granular scopes yet.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Missing authorization token' });

  if (token.startsWith(PAT_PREFIX)) {
    try {
      const pat = await prisma.personalAccessToken.findUnique({ where: { tokenHash: hashPatToken(token) } });
      if (!pat || pat.revokedAt) return res.status(401).json({ message: 'Invalid or revoked token' });
      prisma.personalAccessToken.update({ where: { id: pat.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      req.auth = { sub: pat.userId, viaPat: true, patId: pat.id };
      return next();
    } catch {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  }

  try {
    req.auth = verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}
