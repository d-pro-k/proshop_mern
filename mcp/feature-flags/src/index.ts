import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type FeaturesFile,
  type OpError,
  type Status,
  adjustTrafficRollout,
  getFeatureInfo,
  listFeatures,
  setFeatureState,
} from './logic.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FEATURES_PATH =
  process.env.FEATURES_JSON_PATH ??
  process.argv[2] ??
  path.resolve(__dirname, '../../../backend/features.json')

const today = (): string => new Date().toISOString().slice(0, 10)

const readFlags = async (): Promise<FeaturesFile> => {
  const raw = await readFile(FEATURES_PATH, 'utf-8')
  return JSON.parse(raw) as FeaturesFile
}

// Atomic write (per feature-flags-spec.md §3): write to .tmp, then rename.
const writeFlags = async (flags: FeaturesFile): Promise<void> => {
  const tmp = `${FEATURES_PATH}.tmp`
  await writeFile(tmp, JSON.stringify(flags, null, 2) + '\n', 'utf-8')
  await rename(tmp, FEATURES_PATH)
}

const ok = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
})

const err = (
  code: string,
  message: string,
  feature_id?: string,
) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify(
        feature_id ? { error: code, message, feature_id } : { error: code, message },
        null,
        2,
      ),
    },
  ],
  isError: true,
})

const errFromOp = (e: OpError) => err(e.code, e.message, e.feature_id)

const safeRead = async () => {
  try {
    return { ok: true as const, flags: await readFlags() }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    if (e instanceof SyntaxError) {
      return { ok: false as const, error: err('JSON_PARSE_ERROR', message) }
    }
    return { ok: false as const, error: err('FILE_READ_ERROR', message) }
  }
}

const safeWrite = async (flags: FeaturesFile) => {
  try {
    await writeFlags(flags)
    return { ok: true as const }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false as const, error: err('FILE_WRITE_ERROR', message) }
  }
}

const server = new McpServer({
  name: 'proshop-feature-flags',
  version: '0.1.0',
})

server.registerTool(
  'get_feature_info',
  {
    description: [
      "Retrieve the complete current state of a single feature flag in proshop_mern: name, description, status (Disabled/Testing/Enabled), traffic_percentage, last_modified, dependencies, and any optional fields (targeted_segments, rollout_strategy).",
      "WHEN TO USE: the user asks about the status, rollout, traffic share, or configuration of a specific known feature ('what's the status of search_v2?', 'is dark_mode enabled?', 'show me payment_stripe_v3 details').",
      "WHEN NOT TO USE: for an overview of all features — call list_features instead. To change state — call set_feature_state. To adjust rollout percentage — call adjust_traffic_rollout. You MUST call this rather than reading backend/features.json directly with grep or file tools.",
      "Examples:",
      "  get_feature_info({ feature_id: 'search_v2' })",
      "  get_feature_info({ feature_id: 'dark_mode' })",
    ].join('\n'),
    inputSchema: {
      feature_id: z
        .string()
        .describe(
          "The snake_case key of the feature in features.json, e.g. 'search_v2', 'payment_stripe_v3'. Case-sensitive.",
        ),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ feature_id }) => {
    const r = await safeRead()
    if (!r.ok) return r.error
    const res = getFeatureInfo(r.flags, feature_id)
    if (!res.ok) return errFromOp(res.error)
    return ok(res.value)
  },
)

server.registerTool(
  'set_feature_state',
  {
    description: [
      "Change a feature flag's status to one of: Disabled, Testing, Enabled (case-sensitive).",
      "SIDE EFFECTS (always applied):",
      "  • Disabled → traffic_percentage forced to 0.",
      "  • Enabled  → traffic_percentage forced to 100.",
      "  • Testing  → traffic_percentage kept if currently in 1–99, otherwise reset to 10 (safe canary default).",
      "  • last_modified always set to today (YYYY-MM-DD).",
      "DEPENDENCIES: if state is Testing or Enabled and any item in `dependencies` has status !== 'Enabled', the response includes a non-empty `warnings` array. The write still succeeds — these are warnings, NOT blocks. Pass warnings on to the user.",
      "WHEN TO USE: the user wants to disable a feature ('turn off paypal_express_buttons'), promote a feature to full rollout ('enable search_v2'), or start canary testing ('move dark_mode to Testing'). You MUST call this instead of editing backend/features.json directly.",
      "WHEN NOT TO USE: only the rollout percentage changes for a Testing feature → use adjust_traffic_rollout. You MUST NOT retry on warnings; surface them to the user.",
      "Examples:",
      "  set_feature_state({ feature_id: 'search_v2', state: 'Enabled' })",
      "  set_feature_state({ feature_id: 'paypal_express_buttons', state: 'Disabled' })  // kill switch",
      "  set_feature_state({ feature_id: 'dark_mode', state: 'Testing' })",
    ].join('\n'),
    inputSchema: {
      feature_id: z
        .string()
        .describe("snake_case key of the target feature, e.g. 'search_v2'."),
      state: z
        .enum(['Disabled', 'Testing', 'Enabled'])
        .describe(
          "Target status. Must be exactly one of 'Disabled', 'Testing', 'Enabled' (case-sensitive). Other values are rejected by schema validation before reaching the handler.",
        ),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ feature_id, state }) => {
    const r = await safeRead()
    if (!r.ok) return r.error
    const res = setFeatureState(r.flags, feature_id, state as Status, today())
    if (!res.ok) return errFromOp(res.error)
    const w = await safeWrite(res.value.flags)
    if (!w.ok) return w.error
    return ok(res.value.payload)
  },
)

server.registerTool(
  'adjust_traffic_rollout',
  {
    description: [
      "Change the traffic_percentage (0..100, integer) of a feature whose current status is Testing. Updates last_modified to today.",
      "VALIDATION: percentage must be an integer in the inclusive range 0..100. Non-integers and out-of-range values are rejected with INVALID_PERCENTAGE.",
      "STATUS LOCK: You MUST only call this when the feature's status is currently 'Testing'. If the feature is Disabled or Enabled, the call returns WRONG_STATUS_FOR_ROLLOUT — call set_feature_state first to move it to Testing.",
      "HINTS in successful responses:",
      "  • percentage === 0   → hint: consider set_feature_state(..., 'Disabled') instead.",
      "  • percentage === 100 → hint: consider set_feature_state(..., 'Enabled') to lock in the rollout.",
      "  • otherwise          → hint is null.",
      "WHEN TO USE: canary expansion ('roll search_v2 out to 50%'), rollback during a Testing phase ('reduce dark_mode to 5%'), or A/B traffic split adjustments.",
      "WHEN NOT TO USE: the feature is not in Testing — change status first via set_feature_state. To change status itself — also use set_feature_state.",
      "Examples:",
      "  adjust_traffic_rollout({ feature_id: 'search_v2', percentage: 25 })",
      "  adjust_traffic_rollout({ feature_id: 'dark_mode', percentage: 100 })  // hint: promote to Enabled",
    ].join('\n'),
    inputSchema: {
      feature_id: z
        .string()
        .describe("snake_case key of the target feature, e.g. 'search_v2'."),
      percentage: z
        .number()
        .int()
        .min(0)
        .max(100)
        .describe(
          "Integer in [0, 100] inclusive. Non-integer values (e.g. 12.5) and out-of-range values (e.g. -50, 200) are rejected by schema validation before reaching the handler.",
        ),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ feature_id, percentage }) => {
    const r = await safeRead()
    if (!r.ok) return r.error
    const res = adjustTrafficRollout(r.flags, feature_id, percentage, today())
    if (!res.ok) return errFromOp(res.error)
    const w = await safeWrite(res.value.flags)
    if (!w.ok) return w.error
    return ok(res.value.payload)
  },
)

server.registerTool(
  'list_features',
  {
    description: [
      "Return a compact summary of all 25 feature flags in proshop_mern: each entry is { feature_id, name, status, traffic_percentage }. Heavy fields (description, dependencies, last_modified, targeted_segments) are omitted to keep the conversation small.",
      "WHEN TO USE: the user asks for an overview of features ('show me all flags', 'what features are in Testing right now?', 'list disabled features'), or you need to discover the exact feature_id before calling get_feature_info / set_feature_state.",
      "WHEN NOT TO USE: details about a single known feature — use get_feature_info instead. You MUST use this rather than grep'ing or reading backend/features.json directly when the user wants a list.",
      "Example:",
      "  list_features() → [{ feature_id: 'search_v2', name: 'New Search Algorithm', status: 'Testing', traffic_percentage: 15 }, ...]",
    ].join('\n'),
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    const r = await safeRead()
    if (!r.ok) return r.error
    return ok(listFeatures(r.flags))
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
