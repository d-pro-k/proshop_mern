import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Characterization tests for SEC-04 — feature-flags read API is unauthenticated
// (backend/routes/featureFlagRoutes.js). Written BEFORE the fix to pin the current
// public behavior. The fix adds protect + admin, so anonymous access is denied
// while an authenticated admin keeps working. jwt + User are mocked so the admin
// path can pass through `protect` without a database.

vi.mock('jsonwebtoken', () => ({ default: { verify: vi.fn() } }));
vi.mock('../../../../backend/models/userModel.js', () => ({
  default: { findById: vi.fn() },
}));

import jwt from 'jsonwebtoken';
import User from '../../../../backend/models/userModel.js';
import featureFlagRoutes from '../../../../backend/routes/featureFlagRoutes.js';

function makeApp() {
  const app = express();
  app.use('/', featureFlagRoutes);
  // minimal error handler mirroring the app's: honor a status already set by a
  // controller/middleware, default to 500 otherwise.
  app.use((err, req, res, next) => {
    const code = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
    res.status(code).json({ message: err.message });
  });
  return app;
}

const ADMIN_AUTH = { Authorization: 'Bearer admin-token' };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret';
  // admin auth path (only exercised once the routes are protected)
  jwt.verify.mockReturnValue({ id: 'admin-1' });
  User.findById.mockReturnValue({
    select: vi.fn().mockResolvedValue({ _id: 'admin-1', isAdmin: true }),
  });
});

describe('feature-flags routes — access control (characterization)', () => {
  it('denies the flag list to an anonymous caller with 401 (SEC-04 target)', async () => {
    // INTENTIONAL BEHAVIOR CHANGE — see fix-4-feature-flags-auth.md.
    // Pre-fix this pinned the public endpoint (200). The fix adds protect + admin,
    // so an anonymous caller is now rejected before reaching the controller.
    const res = await request(makeApp()).get('/');
    expect(res.status).toBe(401);
  });

  it('denies a single flag lookup to an anonymous caller with 401 (SEC-04 target)', async () => {
    // INTENTIONAL BEHAVIOR CHANGE — see fix-4-feature-flags-auth.md.
    // Pre-fix an unknown id reached the controller (404); now auth is enforced first.
    const res = await request(makeApp()).get('/__does_not_exist__');
    expect(res.status).toBe(401);
  });

  it('serves the flag list to an authenticated admin (non-target)', async () => {
    const res = await request(makeApp()).get('/').set(ADMIN_AUTH);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 404 for an unknown flag to an authenticated admin (non-target, edge)', async () => {
    const res = await request(makeApp()).get('/__does_not_exist__').set(ADMIN_AUTH);
    expect(res.status).toBe(404);
  });
});
