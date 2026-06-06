import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// PRIVACY INVARIANTS for the assistant's cloud path. Three guarantees:
//  (a) minimization  — a minimized order carries no shipping/payment/identity fields;
//  (b) prepare        — the cloud context is scoped to the session and never contains
//                       the real customer name (masked) or PII order fields;
//  (c) masking round-trip — the cloud only ever sees tokens; the user gets real values.

import {
  minimizeOrder,
  tokenizePII,
  deanonymize,
  PII_ORDER_FIELDS,
} from '../../../backend/utils/assistantPrivacy.js';

// ---------------------------------------------------------------------------
// minimizeOrder
// ---------------------------------------------------------------------------
describe('minimizeOrder — drops PII, keeps what the cloud legitimately needs', () => {
  const rawOrder = {
    _id: 'order-1',
    user: 'user-1',
    isPaid: true,
    isDelivered: true,
    deliveredAt: '2026-06-03T00:00:00.000Z',
    totalPrice: 793.48,
    paymentMethod: 'PayPal',
    shippingAddress: {
      address: '221B Baker Street',
      city: 'London',
      postalCode: 'NW1 6XE',
      country: 'UK',
    },
    paymentResult: { id: 'PAY-123', email_address: 'payer@example.com' },
    orderItems: [
      { name: 'Airpods', qty: 1, price: 89.99, image: '/img.jpg', product: 'p1' },
    ],
  };

  it('keeps order id, status, totals and line items', () => {
    const m = minimizeOrder(rawOrder);
    expect(m.orderId).toBe('order-1');
    expect(m.status).toBe('delivered');
    expect(m.isPaid).toBe(true);
    expect(m.totalPrice).toBe(793.48);
    expect(m.items).toEqual([{ name: 'Airpods', qty: 1, price: 89.99 }]);
  });

  it('drops every PII-bearing order field', () => {
    const m = minimizeOrder(rawOrder);
    const serialized = JSON.stringify(m);
    for (const field of PII_ORDER_FIELDS) {
      expect(m).not.toHaveProperty(field);
    }
    // and the actual sensitive values must not survive anywhere in the projection
    expect(serialized).not.toContain('Baker Street');
    expect(serialized).not.toContain('NW1 6XE');
    expect(serialized).not.toContain('payer@example.com');
    expect(serialized).not.toContain('PAY-123');
    // line-item images are not needed by the cloud and are dropped too
    expect(serialized).not.toContain('/img.jpg');
  });

  it('derives status from payment/delivery state', () => {
    expect(minimizeOrder({ _id: 'a', isPaid: true, isDelivered: true }).status).toBe(
      'delivered'
    );
    expect(
      minimizeOrder({ _id: 'b', isPaid: true, isDelivered: false }).status
    ).toBe('paid, awaiting delivery');
    expect(
      minimizeOrder({ _id: 'c', isPaid: false, isDelivered: false }).status
    ).toBe('not paid');
  });

  it('unwraps a mongoose document via toObject()', () => {
    const doc = {
      toObject: () => ({ _id: 'order-2', isPaid: false, orderItems: [] }),
    };
    const m = minimizeOrder(doc);
    expect(m.orderId).toBe('order-2');
    expect(m.items).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// tokenizePII / deanonymize
// ---------------------------------------------------------------------------
describe('tokenizePII — reversible, Presidio-span-driven masking', () => {
  it('masks a detected span and records the mapping', () => {
    const text = 'Customer: John Doe ordered an iPhone';
    const spans = [{ entity_type: 'PERSON', start: 10, end: 18, score: 0.99 }];
    const { masked, mapping } = tokenizePII(text, spans);
    expect(masked).toBe('Customer: <PERSON_1> ordered an iPhone');
    expect(mapping).toEqual({ '<PERSON_1>': 'John Doe' });
  });

  it('collapses identical values to a single token', () => {
    const text = 'John Doe is John Doe';
    const spans = [
      { entity_type: 'PERSON', start: 0, end: 8 },
      { entity_type: 'PERSON', start: 12, end: 20 },
    ];
    const { masked, mapping } = tokenizePII(text, spans);
    expect(masked).toBe('<PERSON_1> is <PERSON_1>');
    expect(Object.keys(mapping)).toEqual(['<PERSON_1>']);
  });

  it('numbers distinct values and entity types independently', () => {
    const text = 'Alice emailed bob@x.com about Carol';
    const spans = [
      { entity_type: 'PERSON', start: 0, end: 5 }, // Alice
      { entity_type: 'EMAIL_ADDRESS', start: 14, end: 23 }, // bob@x.com
      { entity_type: 'PERSON', start: 30, end: 35 }, // Carol
    ];
    const { masked, mapping } = tokenizePII(text, spans);
    expect(masked).toBe('<PERSON_1> emailed <EMAIL_ADDRESS_1> about <PERSON_2>');
    expect(mapping).toEqual({
      '<PERSON_1>': 'Alice',
      '<EMAIL_ADDRESS_1>': 'bob@x.com',
      '<PERSON_2>': 'Carol',
    });
  });

  it('returns text unchanged and an empty mapping when no spans are given', () => {
    const { masked, mapping } = tokenizePII('nothing to hide here', []);
    expect(masked).toBe('nothing to hide here');
    expect(mapping).toEqual({});
  });

  it('round-trips: deanonymize restores exactly what tokenizePII masked', () => {
    const text = 'Ship to Jane Roe in Paris, contact Jane Roe';
    const spans = [
      { entity_type: 'PERSON', start: 8, end: 16 },
      { entity_type: 'LOCATION', start: 20, end: 25 },
      { entity_type: 'PERSON', start: 35, end: 43 },
    ];
    const { masked, mapping } = tokenizePII(text, spans);
    // cloud never sees the real values
    expect(masked).not.toContain('Jane Roe');
    expect(masked).not.toContain('Paris');
    // user gets them back verbatim
    expect(deanonymize(masked, mapping)).toBe(text);
  });
});

describe('deanonymize', () => {
  it('replaces every occurrence of each token', () => {
    expect(
      deanonymize('Hi <PERSON_1>, bye <PERSON_1>', { '<PERSON_1>': 'Sam' })
    ).toBe('Hi Sam, bye Sam');
  });

  it('returns the text unchanged for an empty mapping', () => {
    expect(deanonymize('no tokens here', {})).toBe('no tokens here');
  });
});

// ---------------------------------------------------------------------------
// Controller: prepareAssistantContext / restoreAssistantReply
// ---------------------------------------------------------------------------
vi.mock('../../../backend/models/orderModel.js', () => ({
  default: { find: vi.fn() },
}));
vi.mock('../../../backend/models/productModel.js', () => ({
  default: { find: vi.fn() },
}));
vi.mock('../../../backend/models/chatLogModel.js', () => ({
  default: { find: vi.fn() },
}));

import Order from '../../../backend/models/orderModel.js';
import {
  prepareAssistantContext,
  restoreAssistantReply,
} from '../../../backend/controllers/assistantController.js';

const OWNER = 'owner-id-1';
const ATTACKER = 'attacker-id-2';

function makeRes() {
  return { json: vi.fn(), status: vi.fn(function () { return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prepareAssistantContext — cloud-safe context from the user’s own data', () => {
  it('scopes to req.user, minimizes, and masks the name so the cloud sees no PII', async () => {
    // Presidio analyzer is stubbed to find nothing; the controller's safety net
    // must still mask the known customer name.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
    );
    Order.find.mockResolvedValue([
      {
        _id: 'order-1',
        user: OWNER,
        isPaid: true,
        isDelivered: true,
        deliveredAt: '2026-06-03T00:00:00.000Z',
        totalPrice: 793.48,
        shippingAddress: { address: '221B Baker Street', city: 'London' },
        paymentResult: { id: 'PAY-123' },
        orderItems: [{ name: 'Airpods', qty: 1, price: 89.99 }],
      },
    ]);

    const req = {
      user: { _id: OWNER, name: 'John Doe' },
      body: { userId: ATTACKER },
    };
    const res = makeRes();

    await prepareAssistantContext(req, res, vi.fn());

    // scoped to the session, not the spoofed body id
    expect(Order.find).toHaveBeenCalledWith({ user: OWNER });
    expect(Order.find).not.toHaveBeenCalledWith({ user: ATTACKER });

    const payload = res.json.mock.calls[0][0];
    expect(payload.minimized).toBe(true);
    expect(payload.masked).toBe(true);
    expect(payload.mapping).toMatchObject({ '<PERSON_1>': 'John Doe' });

    // INVARIANT: nothing sensitive leaks into the cloud context
    expect(payload.context).toContain('<PERSON_1>');
    expect(payload.context).not.toContain('John Doe');
    expect(payload.context).not.toContain('Baker Street');
    expect(payload.context).not.toContain('PAY-123');
  });

  it('still masks the name when Presidio is unreachable (fail-safe)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('presidio down'))
    );
    Order.find.mockResolvedValue([]);

    const req = { user: { _id: OWNER, name: 'Иван Петров' }, body: {} };
    const res = makeRes();

    await prepareAssistantContext(req, res, vi.fn());

    const payload = res.json.mock.calls[0][0];
    // even a non-Latin name Presidio would miss must not reach the cloud
    expect(payload.context).not.toContain('Иван Петров');
    expect(payload.masked).toBe(true);
    expect(payload.mapping).toMatchObject({ '<PERSON_1>': 'Иван Петров' });
  });
});

describe('restoreAssistantReply — de-anonymizes the reply for the user', () => {
  it('restores real values from the mapping', async () => {
    const req = {
      body: {
        text: 'Summary for <PERSON_1> — your order shipped',
        mapping: { '<PERSON_1>': 'John Doe' },
      },
    };
    const res = makeRes();

    await restoreAssistantReply(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({
      reply: 'Summary for John Doe — your order shipped',
    });
  });

  it('handles a missing body without throwing', async () => {
    const req = { body: {} };
    const res = makeRes();
    await restoreAssistantReply(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith({ reply: '' });
  });
});
