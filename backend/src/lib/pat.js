import crypto from 'node:crypto';

export const PAT_PREFIX = 'tfpat_';

export function generatePatToken() {
  return `${PAT_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

// SHA-256, not bcrypt: PATs are 256 bits of server-generated randomness,
// not human-memorable secrets, so a fast deterministic hash is both
// sufficient and necessary -- it's what makes O(1) lookup-by-token
// possible on every authenticated request. There's nothing for an
// attacker to offline-brute-force against this much entropy.
export function hashPatToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
