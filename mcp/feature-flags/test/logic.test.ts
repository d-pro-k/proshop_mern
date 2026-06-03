import { describe, it, expect } from 'vitest'
import {
  canonicalTrafficForState,
  dependencyWarnings,
  getFeatureInfo,
  setFeatureState,
  adjustTrafficRollout,
  listFeatures,
  VALID_STATES,
  type Feature,
  type FeaturesFile,
} from '../src/logic'

// Deterministic timestamp used by every state/traffic mutation. Never a real clock.
const TODAY = '2026-01-15'

// --- Fixture builders -------------------------------------------------------

const makeFeature = (overrides: Partial<Feature> = {}): Feature => ({
  name: 'Search v2',
  description: 'Next-generation search experience',
  status: 'Disabled',
  traffic_percentage: 0,
  last_modified: '2025-12-01',
  ...overrides,
})

// A small, realistic catalog with snake_case ids and a dependency edge.
const makeFlags = (): FeaturesFile => ({
  search_v2: makeFeature({
    name: 'Search v2',
    status: 'Testing',
    traffic_percentage: 25,
    last_modified: '2025-11-20',
    rollout_strategy: 'canary',
    dependencies: ['payment_stripe_v3'],
  }),
  payment_stripe_v3: makeFeature({
    name: 'Stripe Payments v3',
    description: 'Stripe-backed checkout',
    status: 'Enabled',
    traffic_percentage: 100,
    last_modified: '2025-10-05',
  }),
  dark_mode: makeFeature({
    name: 'Dark Mode',
    description: 'Dark theme toggle',
    status: 'Disabled',
    traffic_percentage: 0,
    last_modified: '2025-09-15',
  }),
})

// ---------------------------------------------------------------------------
// VALID_STATES
// ---------------------------------------------------------------------------

describe('VALID_STATES', () => {
  it('lists exactly the three case-sensitive statuses in order', () => {
    expect(VALID_STATES).toEqual(['Disabled', 'Testing', 'Enabled'])
  })
})

// ---------------------------------------------------------------------------
// canonicalTrafficForState
// ---------------------------------------------------------------------------

describe('canonicalTrafficForState', () => {
  it('forces Disabled to 0 percent regardless of current traffic', () => {
    expect(canonicalTrafficForState('Disabled', 73)).toBe(0)
  })

  it('forces Enabled to 100 percent regardless of current traffic', () => {
    expect(canonicalTrafficForState('Enabled', 42)).toBe(100)
  })

  it('keeps an in-range Testing canary value unchanged', () => {
    expect(canonicalTrafficForState('Testing', 25)).toBe(25)
  })

  it('preserves the lower Testing boundary of 1 percent', () => {
    expect(canonicalTrafficForState('Testing', 1)).toBe(1)
  })

  it('preserves the upper Testing boundary of 99 percent', () => {
    expect(canonicalTrafficForState('Testing', 99)).toBe(99)
  })

  it('resets Testing traffic of 0 to the 10 percent canary default', () => {
    expect(canonicalTrafficForState('Testing', 0)).toBe(10)
  })

  it('resets Testing traffic of exactly 100 to the 10 percent canary default', () => {
    expect(canonicalTrafficForState('Testing', 100)).toBe(10)
  })

  it('resets Testing traffic above 100 to the 10 percent canary default', () => {
    expect(canonicalTrafficForState('Testing', 250)).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// dependencyWarnings
// ---------------------------------------------------------------------------

describe('dependencyWarnings', () => {
  it('returns an empty array when the feature declares no dependencies', () => {
    const feature = makeFeature({ dependencies: undefined })
    expect(dependencyWarnings(feature, 'search_v2', makeFlags())).toEqual([])
  })

  it('returns an empty array when the dependencies array is empty', () => {
    const feature = makeFeature({ dependencies: [] })
    expect(dependencyWarnings(feature, 'search_v2', makeFlags())).toEqual([])
  })

  it('warns with the exact not-found message when a dependency is absent from the file', () => {
    const feature = makeFeature({ dependencies: ['ghost_service'] })
    const warnings = dependencyWarnings(feature, 'search_v2', makeFlags())
    expect(warnings).toEqual([
      "Dependency 'ghost_service' is referenced by 'search_v2' but not found in features.json.",
    ])
  })

  it('warns with the exact status message when a dependency exists but is not Enabled', () => {
    const flags = makeFlags()
    const feature = makeFeature({ dependencies: ['dark_mode'] })
    const warnings = dependencyWarnings(feature, 'search_v2', flags)
    expect(warnings).toEqual([
      "Dependency 'dark_mode' is in status 'Disabled', not 'Enabled'. search_v2 may not function correctly.",
    ])
  })

  it('returns no warning when the only dependency is Enabled', () => {
    const feature = makeFeature({ dependencies: ['payment_stripe_v3'] })
    expect(dependencyWarnings(feature, 'search_v2', makeFlags())).toEqual([])
  })

  it('reports a warning per broken dependency while skipping the Enabled one', () => {
    const feature = makeFeature({
      dependencies: ['payment_stripe_v3', 'dark_mode', 'ghost_service'],
    })
    const warnings = dependencyWarnings(feature, 'search_v2', makeFlags())
    expect(warnings).toEqual([
      "Dependency 'dark_mode' is in status 'Disabled', not 'Enabled'. search_v2 may not function correctly.",
      "Dependency 'ghost_service' is referenced by 'search_v2' but not found in features.json.",
    ])
  })
})

// ---------------------------------------------------------------------------
// getFeatureInfo
// ---------------------------------------------------------------------------

describe('getFeatureInfo', () => {
  it('returns the feature merged with its id when the id exists', () => {
    const result = getFeatureInfo(makeFlags(), 'payment_stripe_v3')
    expect(result).toEqual({
      ok: true,
      value: {
        feature_id: 'payment_stripe_v3',
        name: 'Stripe Payments v3',
        description: 'Stripe-backed checkout',
        status: 'Enabled',
        traffic_percentage: 100,
        last_modified: '2025-10-05',
      },
    })
  })

  it('returns a FEATURE_NOT_FOUND error with the id echoed back when the id is unknown', () => {
    const result = getFeatureInfo(makeFlags(), 'does_not_exist')
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FEATURE_NOT_FOUND',
        message: "No feature with ID 'does_not_exist' exists in features.json.",
        feature_id: 'does_not_exist',
      },
    })
  })
})

// ---------------------------------------------------------------------------
// listFeatures
// ---------------------------------------------------------------------------

describe('listFeatures', () => {
  it('returns a compact summary per feature, omitting heavy fields', () => {
    const summaries = listFeatures(makeFlags())
    expect(summaries).toEqual([
      { feature_id: 'search_v2', name: 'Search v2', status: 'Testing', traffic_percentage: 25 },
      {
        feature_id: 'payment_stripe_v3',
        name: 'Stripe Payments v3',
        status: 'Enabled',
        traffic_percentage: 100,
      },
      { feature_id: 'dark_mode', name: 'Dark Mode', status: 'Disabled', traffic_percentage: 0 },
    ])
  })

  it('does not leak description, last_modified or other heavy fields into the summary', () => {
    const [first] = listFeatures(makeFlags())
    expect(Object.keys(first).sort()).toEqual([
      'feature_id',
      'name',
      'status',
      'traffic_percentage',
    ])
  })

  it('returns an empty array for an empty features file', () => {
    expect(listFeatures({})).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// setFeatureState
// ---------------------------------------------------------------------------

describe('setFeatureState', () => {
  it('rejects an invalid state with INVALID_STATE before touching the file', () => {
    const result = setFeatureState(makeFlags(), 'search_v2', 'Active' as never, TODAY)
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message:
          "State 'Active' is not valid. Must be one of: Disabled, Testing, Enabled (case-sensitive).",
        feature_id: 'search_v2',
      },
    })
  })

  it('rejects an unknown feature id with FEATURE_NOT_FOUND', () => {
    const result = setFeatureState(makeFlags(), 'missing_flag', 'Enabled', TODAY)
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FEATURE_NOT_FOUND',
        message: "No feature with ID 'missing_flag' exists in features.json.",
        feature_id: 'missing_flag',
      },
    })
  })

  it('forces traffic to 0 when moving a feature to Disabled', () => {
    const flags = makeFlags()
    const result = setFeatureState(flags, 'search_v2', 'Disabled', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.traffic_percentage).toBe(0)
    expect(result.value.payload.status).toBe('Disabled')
  })

  it('always returns empty warnings on Disable even when a dependency is broken', () => {
    // search_v2 depends on payment_stripe_v3; break that dependency so the
    // ONLY reason warnings could be empty is the Disable short-circuit (edge #5).
    const flags = makeFlags()
    flags.payment_stripe_v3.status = 'Testing'
    const result = setFeatureState(flags, 'search_v2', 'Disabled', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.warnings).toEqual([])
  })

  it('forces traffic to 100 when moving a feature to Enabled', () => {
    const result = setFeatureState(makeFlags(), 'dark_mode', 'Enabled', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.traffic_percentage).toBe(100)
    expect(result.value.payload.status).toBe('Enabled')
  })

  it('resets traffic to the 10 percent canary default when moving Disabled (0%) to Testing', () => {
    const result = setFeatureState(makeFlags(), 'dark_mode', 'Testing', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.traffic_percentage).toBe(10)
    expect(result.value.payload.status).toBe('Testing')
  })

  it('preserves an in-range traffic value when re-confirming Testing', () => {
    // search_v2 starts Testing at 25 — an in-range canary value should survive.
    const result = setFeatureState(makeFlags(), 'search_v2', 'Testing', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.traffic_percentage).toBe(25)
  })

  it('emits a dependency warning when promoting a feature whose dependency is not Enabled', () => {
    const flags = makeFlags()
    flags.payment_stripe_v3.status = 'Testing'
    const result = setFeatureState(flags, 'search_v2', 'Enabled', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.warnings).toEqual([
      "Dependency 'payment_stripe_v3' is in status 'Testing', not 'Enabled'. search_v2 may not function correctly.",
    ])
  })

  it('stamps last_modified with the passed today value', () => {
    const result = setFeatureState(makeFlags(), 'search_v2', 'Enabled', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.last_modified).toBe(TODAY)
  })

  it('does not mutate the original flags object', () => {
    const flags = makeFlags()
    const before = JSON.parse(JSON.stringify(flags))
    setFeatureState(flags, 'search_v2', 'Enabled', TODAY)
    expect(flags).toEqual(before)
  })

  it('returns a new flags object distinct from the input reference', () => {
    const flags = makeFlags()
    const result = setFeatureState(flags, 'search_v2', 'Enabled', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.flags).not.toBe(flags)
  })

  it('updates only the target feature and leaves the others untouched', () => {
    const flags = makeFlags()
    const result = setFeatureState(flags, 'search_v2', 'Enabled', TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.flags.search_v2.status).toBe('Enabled')
    expect(result.value.flags.payment_stripe_v3).toEqual(flags.payment_stripe_v3)
    expect(result.value.flags.dark_mode).toEqual(flags.dark_mode)
  })
})

// ---------------------------------------------------------------------------
// adjustTrafficRollout
// ---------------------------------------------------------------------------

describe('adjustTrafficRollout', () => {
  it('rejects a non-integer percentage with INVALID_PERCENTAGE', () => {
    const result = adjustTrafficRollout(makeFlags(), 'search_v2', 33.5, TODAY)
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INVALID_PERCENTAGE',
        message: 'percentage must be an integer in [0, 100]. Received: 33.5.',
        feature_id: 'search_v2',
      },
    })
  })

  it('rejects a negative percentage with INVALID_PERCENTAGE', () => {
    const result = adjustTrafficRollout(makeFlags(), 'search_v2', -1, TODAY)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error result')
    expect(result.error.code).toBe('INVALID_PERCENTAGE')
  })

  it('rejects a percentage above 100 with INVALID_PERCENTAGE', () => {
    const result = adjustTrafficRollout(makeFlags(), 'search_v2', 101, TODAY)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error result')
    expect(result.error.code).toBe('INVALID_PERCENTAGE')
  })

  it('rejects an unknown feature id with FEATURE_NOT_FOUND', () => {
    const result = adjustTrafficRollout(makeFlags(), 'missing_flag', 50, TODAY)
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FEATURE_NOT_FOUND',
        message: "No feature with ID 'missing_flag' exists in features.json.",
        feature_id: 'missing_flag',
      },
    })
  })

  it('refuses to adjust a feature that is not in Testing with WRONG_STATUS_FOR_ROLLOUT', () => {
    const result = adjustTrafficRollout(makeFlags(), 'payment_stripe_v3', 50, TODAY)
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WRONG_STATUS_FOR_ROLLOUT',
        message:
          "adjust_traffic_rollout can only be called on features with status 'Testing'. 'payment_stripe_v3' is currently 'Enabled'. Use set_feature_state to change its status first.",
        feature_id: 'payment_stripe_v3',
      },
    })
  })

  it('does not mutate flags when it rejects a non-Testing feature', () => {
    const flags = makeFlags()
    const before = JSON.parse(JSON.stringify(flags))
    adjustTrafficRollout(flags, 'payment_stripe_v3', 50, TODAY)
    expect(flags).toEqual(before)
  })

  it('returns a Disabled hint when rolling traffic down to 0 percent', () => {
    const result = adjustTrafficRollout(makeFlags(), 'search_v2', 0, TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.traffic_percentage).toBe(0)
    expect(result.value.payload.hint).toBe(
      "Consider set_feature_state('search_v2', 'Disabled') instead — Testing at 0% is equivalent to off.",
    )
  })

  it('returns an Enabled hint when rolling traffic up to 100 percent', () => {
    const result = adjustTrafficRollout(makeFlags(), 'search_v2', 100, TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.traffic_percentage).toBe(100)
    expect(result.value.payload.hint).toBe(
      "Consider set_feature_state('search_v2', 'Enabled') to lock in the full rollout.",
    )
  })

  it('returns a null hint for a mid-range percentage', () => {
    const result = adjustTrafficRollout(makeFlags(), 'search_v2', 60, TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.traffic_percentage).toBe(60)
    expect(result.value.payload.hint).toBeNull()
  })

  it('stamps last_modified with the passed today value on a successful adjustment', () => {
    const result = adjustTrafficRollout(makeFlags(), 'search_v2', 60, TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.payload.last_modified).toBe(TODAY)
  })

  it('does not mutate the original flags object on a successful adjustment', () => {
    const flags = makeFlags()
    const before = JSON.parse(JSON.stringify(flags))
    adjustTrafficRollout(flags, 'search_v2', 60, TODAY)
    expect(flags).toEqual(before)
  })

  it('returns a new flags object with only the target feature updated', () => {
    const flags = makeFlags()
    const result = adjustTrafficRollout(flags, 'search_v2', 60, TODAY)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.value.flags).not.toBe(flags)
    expect(result.value.flags.search_v2.traffic_percentage).toBe(60)
    expect(result.value.flags.payment_stripe_v3).toEqual(flags.payment_stripe_v3)
    expect(result.value.flags.dark_mode).toEqual(flags.dark_mode)
  })
})
