import { describe, it, expect, vi, beforeEach } from 'vitest';

// Characterization tests for SEC-02 — payment authorization on updateOrderToPaid
// (backend/controllers/orderController.js). Written BEFORE the fix: they pin the
// CURRENT behavior of the endpoint, including the insecure behavior the fix targets.

vi.mock('../../../../backend/models/orderModel.js', () => ({
  default: { findById: vi.fn() },
}));

import Order from '../../../../backend/models/orderModel.js';
import { updateOrderToPaid } from '../../../../backend/controllers/orderController.js';

const OWNER = 'owner-id-1';
const OTHER = 'other-id-2';

const paymentBody = {
  id: 'pay-1',
  status: 'COMPLETED',
  update_time: '2026-05-31T00:00:00Z',
  payer: { email_address: 'payer@example.com' },
};

function makeOrder(ownerId) {
  const order = {
    user: ownerId,
    isPaid: false,
    save: vi.fn(function () {
      return Promise.resolve(this);
    }),
  };
  return order;
}

function makeRes() {
  return { json: vi.fn(), status: vi.fn(function () { return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('updateOrderToPaid — payment authorization (characterization)', () => {
  it('marks the order paid and returns it when the requester is the owner (non-target)', async () => {
    const order = makeOrder(OWNER);
    Order.findById.mockResolvedValue(order);
    const req = { params: { id: 'o1' }, body: paymentBody, user: { _id: OWNER, isAdmin: false } };
    const res = makeRes();
    const next = vi.fn();

    await updateOrderToPaid(req, res, next);

    expect(order.isPaid).toBe(true);
    expect(order.save).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(order);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a NON-owner with 403 and does not mark the order paid (SEC-02 target)', async () => {
    // INTENTIONAL BEHAVIOR CHANGE — see fix-1-payment-authorization.md.
    // Pre-fix this test pinned the insecure status quo (any authenticated user
    // could pay any order). The fix adds an ownership/admin check, so a non-owner
    // is now rejected with 403 and the order is left untouched.
    const order = makeOrder(OWNER);
    Order.findById.mockResolvedValue(order);
    const req = { params: { id: 'o1' }, body: paymentBody, user: { _id: OTHER, isAdmin: false } };
    const res = makeRes();
    const next = vi.fn();

    await updateOrderToPaid(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(order.isPaid).toBe(false);
    expect(order.save).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('allows an admin who is not the owner to mark the order paid (non-target)', async () => {
    const order = makeOrder(OWNER);
    Order.findById.mockResolvedValue(order);
    const req = { params: { id: 'o1' }, body: paymentBody, user: { _id: OTHER, isAdmin: true } };
    const res = makeRes();
    const next = vi.fn();

    await updateOrderToPaid(req, res, next);

    expect(order.isPaid).toBe(true);
    expect(res.json).toHaveBeenCalledWith(order);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist (non-target, error path)', async () => {
    Order.findById.mockResolvedValue(null);
    const req = { params: { id: 'missing' }, body: paymentBody, user: { _id: OWNER, isAdmin: false } };
    const res = makeRes();
    const next = vi.fn();

    await updateOrderToPaid(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
