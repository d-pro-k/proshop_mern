import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../backend/models/chatLogModel.js', () => ({ default: {} }));

import { postAssistantChat } from '../../../backend/controllers/assistantController.js';

const OWNER = 'owner-id-1';

function makeRes() {
  return { json: vi.fn(), status: vi.fn(function () { return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postAssistantChat — proxy to the n8n router', () => {
  it('rejects an empty message with 400', async () => {
    const req = { user: { _id: OWNER }, headers: {}, body: {} };
    const res = makeRes();
    const next = vi.fn();

    await postAssistantChat(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it('forwards userId from the session (not the body) and returns the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ reply: 'hello from router' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      user: { _id: OWNER },
      headers: { authorization: 'Bearer jwt-123' },
      body: { message: 'where is my order?', userId: 'attacker' },
    };
    const res = makeRes();

    await postAssistantChat(req, res, vi.fn());

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    const sent = JSON.parse(options.body);
    expect(sent.userId).toBe(OWNER); // session id, never the body's 'attacker'
    expect(sent.message).toBe('where is my order?');
    expect(options.headers.Authorization).toBe('Bearer jwt-123');
    expect(res.json).toHaveBeenCalledWith({ reply: 'hello from router' });
  });

  it('returns 502 when the router is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const req = { user: { _id: OWNER }, headers: {}, body: { message: 'hi' } };
    const res = makeRes();
    const next = vi.fn();

    await postAssistantChat(req, res, next);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
