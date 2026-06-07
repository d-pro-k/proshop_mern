import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// Read-only view of the feature-flags store (backend/features.json). The
// feature-flags MCP server is the only writer; this helper just reads the
// current state so request handlers can branch on a flag. Kept tiny and
// dependency-free so it can be unit-tested in isolation.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FEATURES_PATH =
  process.env.FEATURES_JSON_PATH || path.resolve(__dirname, '../features.json')

// True only when the flag exists AND its status is exactly 'Enabled'. Any read
// or parse failure resolves to false — fail-safe: an unreadable flag store must
// never silently enable a privileged code path.
export const isFeatureEnabled = async (featureId) => {
  try {
    const raw = await readFile(FEATURES_PATH, 'utf-8')
    const flags = JSON.parse(raw)
    return flags?.[featureId]?.status === 'Enabled'
  } catch (err) {
    return false
  }
}
