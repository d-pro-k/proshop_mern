import { describe, it, expect, vi, beforeEach } from 'vitest';

// SECURITY: the assistant's DB tools must scope by the authenticated session
// (req.user._id), never by client-supplied input. This is the deterministic
// guarantee behind DZ2 — a jailbroken agent cannot widen its own scope.

vi.mock('../../../backend/models/orderModel.js', () => ({
  default: { find: vi.fn() },
}));
vi.mock('../../../backend/models/userModel.js', () => ({
  default: { findById: vi.fn() },
}));

import Order from '../../../backend/models/orderModel.js';
import User from '../../../backend/models/userModel.js';
import { getMyOrders } from '../../../backend/controllers/orderController.js';
import { getUserProfile } from '../../../backend/controllers/userController.js';

const OWNER = 'owner-id-1';
const ATTACKER = 'attacker-id-2';

function makeRes() {
  return { json: vi.fn(), status: vi.fn(function () { return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assistant scoped tools — identity from req.user, not client input', () => {
  it('getMyOrders queries by req.user._id and ignores a spoofed userId', async () => {
    Order.find.mockResolvedValue([{ _id: 'o1', user: OWNER }]);
    const req = {
      user: { _id: OWNER },
      query: { userId: ATTACKER },
      body: { userId: ATTACKER },
    };
    const res = makeRes();

    await getMyOrders(req, res, vi.fn());

    expect(Order.find).toHaveBeenCalledWith({ user: OWNER });
    expect(Order.find).not.toHaveBeenCalledWith({ user: ATTACKER });
  });

  it('getUserProfile loads the session user, not an attacker-supplied id', async () => {
    User.findById.mockResolvedValue({
      _id: OWNER,
      name: 'Owner',
      email: 'owner@example.com',
      isAdmin: false,
    });
    const req = {
      user: { _id: OWNER },
      query: { userId: ATTACKER },
      body: { id: ATTACKER },
    };
    const res = makeRes();

    await getUserProfile(req, res, vi.fn());

    expect(User.findById).toHaveBeenCalledWith(OWNER);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ _id: OWNER, email: 'owner@example.com' })
    );
  });
});
