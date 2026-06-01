import { describe, it, expect, vi, beforeEach } from 'vitest';

// Characterization tests for SEC-01 — IDOR on getOrderById
// (backend/controllers/orderController.js). Written BEFORE the fix to pin the
// current behavior, including the insecure cross-user read the fix targets.
// Note: getOrderById populates `user`, so ownership is on `order.user._id`.

vi.mock('../../../../backend/models/orderModel.js', () => ({
  default: { findById: vi.fn() },
}));

import Order from '../../../../backend/models/orderModel.js';
import { getOrderById } from '../../../../backend/controllers/orderController.js';

const OWNER = 'owner-id-1';
const OTHER = 'other-id-2';

function mockFindByIdReturns(order) {
  Order.findById.mockReturnValue({
    populate: vi.fn().mockResolvedValue(order),
  });
}

function makeOrder(ownerId) {
  return {
    _id: 'o1',
    user: { _id: ownerId, name: 'Owner', email: 'owner@example.com' },
    shippingAddress: { address: '1 Main St' },
  };
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn(function () { return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getOrderById — access control (characterization)', () => {
  it('returns the order to its owner (non-target)', async () => {
    const order = makeOrder(OWNER);
    mockFindByIdReturns(order);
    const req = { params: { id: 'o1' }, user: { _id: OWNER, isAdmin: false } };
    const res = makeRes();
    const next = vi.fn();

    await getOrderById(req, res, next);

    expect(res.json).toHaveBeenCalledWith(order);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a non-owner with 403 instead of leaking the order (SEC-01 target)', async () => {
    // INTENTIONAL BEHAVIOR CHANGE — see fix-2-order-access-control.md.
    // Pre-fix this test pinned the IDOR (any authenticated user could read any
    // order). The fix adds an ownership/admin check, so a non-owner is now denied.
    const order = makeOrder(OWNER);
    mockFindByIdReturns(order);
    const req = { params: { id: 'o1' }, user: { _id: OTHER, isAdmin: false } };
    const res = makeRes();
    const next = vi.fn();

    await getOrderById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('returns any order to an admin (non-target)', async () => {
    const order = makeOrder(OWNER);
    mockFindByIdReturns(order);
    const req = { params: { id: 'o1' }, user: { _id: OTHER, isAdmin: true } };
    const res = makeRes();
    const next = vi.fn();

    await getOrderById(req, res, next);

    expect(res.json).toHaveBeenCalledWith(order);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist (non-target, error path)', async () => {
    mockFindByIdReturns(null);
    const req = { params: { id: 'missing' }, user: { _id: OWNER, isAdmin: false } };
    const res = makeRes();
    const next = vi.fn();

    await getOrderById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
