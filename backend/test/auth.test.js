import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/prisma.js', () => ({
  default: {
    personalAccessToken: {
      findUnique: vi.fn(),
      update: vi.fn().mockReturnValue({ catch: vi.fn() }),
    },
  },
}));

const { requireAuth } = await import('../src/middleware/auth.js');
const { adminOnly } = await import('../src/middleware/adminOnly.js');
const prisma = (await import('../src/lib/prisma.js')).default;
const { PAT_PREFIX } = await import('../src/lib/pat.js');

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireAuth + adminOnly with PAT auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.personalAccessToken.update.mockReturnValue({ catch: vi.fn() });
  });

  it('rejects all PATs from admin-only routes (role not attached in Phase 1)', async () => {
    prisma.personalAccessToken.findUnique.mockResolvedValue({
      id: 'pat1',
      userId: 'user1',
      revokedAt: null,
    });

    const req = { headers: { authorization: `Bearer ${PAT_PREFIX}sometoken` } };
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.auth).toEqual({ sub: 'user1', viaPat: true, patId: 'pat1' });

    const adminNext = vi.fn();
    adminOnly(req, res, adminNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Admin access required' });
  });
});
