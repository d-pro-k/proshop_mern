// Pure decision logic for the feature-flags MCP server.
//
// All functions here are side-effect free: they take an in-memory FeaturesFile
// (plus a `today` string for deterministic timestamps) and return either a
// success value or a structured error. The MCP entry point (index.ts) owns all
// I/O (reading/writing features.json) and server wiring; it delegates every
// decision to this module so the logic can be unit- and mutation-tested without
// booting the stdio transport.

export type Status = 'Disabled' | 'Testing' | 'Enabled'

export interface Feature {
  name: string
  description: string
  status: Status
  traffic_percentage: number
  last_modified: string
  targeted_segments?: string[]
  rollout_strategy?: 'canary' | 'ab_test' | 'full_release'
  dependencies?: string[]
}

export type FeaturesFile = Record<string, Feature>

export const VALID_STATES: Status[] = ['Disabled', 'Testing', 'Enabled']

// Structured error / result types. index.ts maps these onto the MCP
// content/isError envelope via its ok()/err() helpers.
export interface OpError {
  code: string
  message: string
  feature_id?: string
}

export type OpResult<T> = { ok: true; value: T } | { ok: false; error: OpError }

export interface FeatureSummary {
  feature_id: string
  name: string
  status: Status
  traffic_percentage: number
}

export const canonicalTrafficForState = (state: Status, current: number): number => {
  if (state === 'Disabled') return 0
  if (state === 'Enabled') return 100
  // Testing: keep current if it's a sane canary value, else default to 10.
  return current >= 1 && current <= 99 ? current : 10
}

export const dependencyWarnings = (
  feature: Feature,
  feature_id: string,
  flags: FeaturesFile,
): string[] => {
  if (!feature.dependencies || feature.dependencies.length === 0) return []
  const warnings: string[] = []
  for (const depId of feature.dependencies) {
    const dep = flags[depId]
    if (!dep) {
      warnings.push(
        `Dependency '${depId}' is referenced by '${feature_id}' but not found in features.json.`,
      )
      continue
    }
    if (dep.status !== 'Enabled') {
      warnings.push(
        `Dependency '${depId}' is in status '${dep.status}', not 'Enabled'. ${feature_id} may not function correctly.`,
      )
    }
  }
  return warnings
}

const notFound = (feature_id: string): OpError => ({
  code: 'FEATURE_NOT_FOUND',
  message: `No feature with ID '${feature_id}' exists in features.json.`,
  feature_id,
})

export const getFeatureInfo = (
  flags: FeaturesFile,
  feature_id: string,
): OpResult<{ feature_id: string } & Feature> => {
  const feature = flags[feature_id]
  if (!feature) return { ok: false, error: notFound(feature_id) }
  return { ok: true, value: { feature_id, ...feature } }
}

export const listFeatures = (flags: FeaturesFile): FeatureSummary[] =>
  Object.entries(flags).map(([feature_id, f]) => ({
    feature_id,
    name: f.name,
    status: f.status,
    traffic_percentage: f.traffic_percentage,
  }))

export interface StateChange {
  flags: FeaturesFile
  payload: { feature_id: string } & Feature & { warnings: string[] }
}

export const setFeatureState = (
  flags: FeaturesFile,
  feature_id: string,
  state: Status,
  today: string,
): OpResult<StateChange> => {
  if (!VALID_STATES.includes(state)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `State '${state}' is not valid. Must be one of: Disabled, Testing, Enabled (case-sensitive).`,
        feature_id,
      },
    }
  }
  const feature = flags[feature_id]
  if (!feature) return { ok: false, error: notFound(feature_id) }

  const updated: Feature = {
    ...feature,
    status: state,
    traffic_percentage: canonicalTrafficForState(state, feature.traffic_percentage),
    last_modified: today,
  }
  const nextFlags = { ...flags, [feature_id]: updated }
  const warnings = state === 'Disabled' ? [] : dependencyWarnings(updated, feature_id, nextFlags)

  return { ok: true, value: { flags: nextFlags, payload: { feature_id, ...updated, warnings } } }
}

export interface TrafficChange {
  flags: FeaturesFile
  payload: { feature_id: string } & Feature & { hint: string | null }
}

export const adjustTrafficRollout = (
  flags: FeaturesFile,
  feature_id: string,
  percentage: number,
  today: string,
): OpResult<TrafficChange> => {
  if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PERCENTAGE',
        message: `percentage must be an integer in [0, 100]. Received: ${percentage}.`,
        feature_id,
      },
    }
  }
  const feature = flags[feature_id]
  if (!feature) return { ok: false, error: notFound(feature_id) }

  if (feature.status !== 'Testing') {
    return {
      ok: false,
      error: {
        code: 'WRONG_STATUS_FOR_ROLLOUT',
        message: `adjust_traffic_rollout can only be called on features with status 'Testing'. '${feature_id}' is currently '${feature.status}'. Use set_feature_state to change its status first.`,
        feature_id,
      },
    }
  }

  const updated: Feature = { ...feature, traffic_percentage: percentage, last_modified: today }
  const nextFlags = { ...flags, [feature_id]: updated }

  let hint: string | null = null
  if (percentage === 0) {
    hint = `Consider set_feature_state('${feature_id}', 'Disabled') instead — Testing at 0% is equivalent to off.`
  } else if (percentage === 100) {
    hint = `Consider set_feature_state('${feature_id}', 'Enabled') to lock in the full rollout.`
  }

  return { ok: true, value: { flags: nextFlags, payload: { feature_id, ...updated, hint } } }
}
