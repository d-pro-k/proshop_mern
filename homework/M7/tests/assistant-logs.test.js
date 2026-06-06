import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../backend/models/chatLogModel.js', () => ({
  default: { find: vi.fn() },
}));

import ChatLog from '../../../backend/models/chatLogModel.js';
import { getAssistantLogs } from '../../../backend/controllers/assistantController.js';

function makeRes() {
  return { json: vi.fn(), status: vi.fn(function () { return this; }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAssistantLogs — admin dashboard read', () => {
  it('returns newest-first logs with a default cap of 100', async () => {
    const docs = [{ _id: 'l1' }, { _id: 'l2' }];
    const chain = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(docs),
    };
    ChatLog.find.mockReturnValue(chain);

    const req = { query: {} };
    const res = makeRes();

    await getAssistantLogs(req, res, vi.fn());

    expect(ChatLog.find).toHaveBeenCalledWith({});
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(chain.limit).toHaveBeenCalledWith(100);
    expect(res.json).toHaveBeenCalledWith(docs);
  });

  it('caps an excessive limit at 500', async () => {
    const chain = {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    ChatLog.find.mockReturnValue(chain);

    const req = { query: { limit: '99999' } };
    const res = makeRes();

    await getAssistantLogs(req, res, vi.fn());

    expect(chain.limit).toHaveBeenCalledWith(500);
  });
});
