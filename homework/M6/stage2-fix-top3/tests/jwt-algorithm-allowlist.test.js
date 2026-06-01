import { describe, it, expect, vi, beforeEach } from 'vitest';

// Characterization tests for SEC-03 — JWT verified without an algorithm allow-list
// (backend/middleware/authMiddleware.js, protect). Written BEFORE the fix to pin
// current behavior: valid/no/invalid token handling, and the security-relevant
// call contract (verify is currently called with no `algorithms` option).

vi.mock('jsonwebtoken', () => ({ default: { verify: vi.fn() } }));
vi.mock('../../../../backend/models/userModel.js', () => ({
  default: { findById: vi.fn() },
}));

import jwt from 'jsonwebtoken';
import User from '../../../../backend/models/userModel.js';
import { protect } from '../../../../backend/middleware/authMiddleware.js';

function makeRes() {
  return { json: vi.fn(), status: vi.fn(function () { return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  // default: User lookup resolves to a user (overridable per test)
  User.findById.mockReturnValue({
    select: vi.fn().mockResolvedValue({ _id: 'u1', name: 'User' }),
  });
});

describe('protect — JWT verification (characterization)', () => {
  it('attaches the user and calls next for a valid Bearer token (non-target)', async () => {
    jwt.verify.mockReturnValue({ id: 'u1' });
    const req = { headers: { authorization: 'Bearer the-token' } };
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(req.user).toEqual({ _id: 'u1', name: 'User' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0); // next() with no error
  });

  it('returns 401 when no token is present (non-target, error path)', async () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('returns 401 when verification throws (non-target, error path)', async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const req = { headers: { authorization: 'Bearer bad-token' } };
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('verifies with an explicit HS256 algorithm allow-list (SEC-03 target)', async () => {
    // INTENTIONAL BEHAVIOR CHANGE — see fix-3-jwt-algorithm-allowlist.md.
    // Pre-fix this test pinned the insecure call contract (no algorithms option,
    // allowing algorithm-confusion / forged-token attacks). The fix pins HS256.
    jwt.verify.mockReturnValue({ id: 'u1' });
    const req = { headers: { authorization: 'Bearer the-token' } };
    const res = makeRes();
    const next = vi.fn();

    await protect(req, res, next);

    expect(jwt.verify).toHaveBeenCalledTimes(1);
    const args = jwt.verify.mock.calls[0];
    expect(args[0]).toBe('the-token');
    expect(args[1]).toBe('test-secret');
    expect(args[2]).toEqual({ algorithms: ['HS256'] });
  });
});
