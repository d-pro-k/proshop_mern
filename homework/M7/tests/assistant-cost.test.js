import { describe, it, expect } from 'vitest';
import { computeCostUsd } from '../../../backend/utils/assistantCost.js';

// Cost estimation: private (local) turns are free; cloud turns priced from usage.

describe('computeCostUsd', () => {
  it('returns 0 for local (private) turns regardless of tokens', () => {
    expect(
      computeCostUsd({
        route: 'local',
        model: 'gpt-4o',
        promptTokens: 5000,
        completionTokens: 5000,
      })
    ).toBe(0);
  });

  it('prices a cloud gpt-4o-mini turn from token usage', () => {
    // 2000 in * 0.15/1e6 + 500 out * 0.6/1e6 = 0.0003 + 0.0003 = 0.0006
    expect(
      computeCostUsd({
        route: 'cloud',
        model: 'gpt-4o-mini',
        promptTokens: 2000,
        completionTokens: 500,
      })
    ).toBeCloseTo(0.0006, 6);
  });

  it('prices gpt-4o above gpt-4o-mini for identical usage', () => {
    const usage = { route: 'cloud', promptTokens: 1000, completionTokens: 1000 };
    expect(computeCostUsd({ ...usage, model: 'gpt-4o' })).toBeGreaterThan(
      computeCostUsd({ ...usage, model: 'gpt-4o-mini' })
    );
  });

  it('returns 0 for an unknown model instead of guessing a price', () => {
    expect(
      computeCostUsd({
        route: 'cloud',
        model: 'mystery-model',
        promptTokens: 1000,
        completionTokens: 1000,
      })
    ).toBe(0);
  });
});
