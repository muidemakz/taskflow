import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

const accessTtl = process.env.JWT_EXPIRES_IN || '15m';
const refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: accessTtl }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export function refreshExpiryDate() {
  const days = Number.parseInt(refreshTtl, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    avatarUrl: user.avatarUrl,
    theme: user.theme
  };
}
