// Smoke test: spawn the built MCP server as a subprocess via stdio and exercise all 4 tools.
// Usage:
//   1. Make a backup of backend/features.json BEFORE running this — it WILL mutate the file.
//   2. node smoke-test.mjs
//   3. Restore from the backup or revert via git.

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(__dirname, 'dist/index.js')],
})

const client = new Client({ name: 'smoke-test', version: '0.0.1' })
await client.connect(transport)

const banner = (s) => console.log('\n=== ' + s + ' ===')

const callTool = async (name, args) => {
  const res = await client.callTool({ name, arguments: args })
  const text = res.content?.[0]?.text ?? ''
  const isError = !!res.isError
  console.log((isError ? '[ERROR]' : '[OK]   ') + ' ' + name + ' ' + JSON.stringify(args))
  console.log(text)
  return { isError, text, parsed: text ? JSON.parse(text) : null }
}

const expectOk = (label, r) => {
  if (r.isError) throw new Error(`expected OK but got error in ${label}: ${r.text}`)
}
const expectError = (label, code, r) => {
  if (!r.isError) throw new Error(`expected error in ${label} but got OK`)
  if (r.parsed?.error !== code)
    throw new Error(`expected error code ${code} in ${label}, got ${r.parsed?.error}`)
}

try {
  banner('tools/list')
  const tools = await client.listTools()
  console.log(tools.tools.map((t) => t.name).join(', '))
  if (tools.tools.length !== 4) throw new Error('expected 4 tools, got ' + tools.tools.length)

  banner('1. get_feature_info(search_v2) — happy path')
  const r1 = await callTool('get_feature_info', { feature_id: 'search_v2' })
  expectOk('get_feature_info(search_v2)', r1)
  if (r1.parsed.feature_id !== 'search_v2') throw new Error('feature_id echo missing')

  banner('2. get_feature_info(nonexistent) — FEATURE_NOT_FOUND')
  expectError(
    'get_feature_info(nonexistent)',
    'FEATURE_NOT_FOUND',
    await callTool('get_feature_info', { feature_id: 'nonexistent_feature' }),
  )

  banner('3. set_feature_state(semantic_search, Enabled) — should warn (search_v2 is Testing)')
  const r3 = await callTool('set_feature_state', {
    feature_id: 'semantic_search',
    state: 'Enabled',
  })
  expectOk('set_feature_state(semantic_search, Enabled)', r3)
  if (!Array.isArray(r3.parsed.warnings) || r3.parsed.warnings.length === 0)
    throw new Error('expected non-empty warnings (search_v2 is not Enabled)')
  if (r3.parsed.traffic_percentage !== 100) throw new Error('Enabled should force traffic=100')

  banner('4. adjust_traffic_rollout(paypal_express_buttons, 50) — WRONG_STATUS_FOR_ROLLOUT (Enabled)')
  expectError(
    'adjust(paypal_express_buttons, 50)',
    'WRONG_STATUS_FOR_ROLLOUT',
    await callTool('adjust_traffic_rollout', {
      feature_id: 'paypal_express_buttons',
      percentage: 50,
    }),
  )

  banner('5. adjust_traffic_rollout(search_v2, 12.5) — INVALID_PERCENTAGE')
  expectError(
    'adjust(search_v2, 12.5)',
    'INVALID_PERCENTAGE',
    await callTool('adjust_traffic_rollout', { feature_id: 'search_v2', percentage: 12.5 }),
  )

  banner('6. adjust_traffic_rollout(search_v2, 25) — happy path')
  const r6 = await callTool('adjust_traffic_rollout', {
    feature_id: 'search_v2',
    percentage: 25,
  })
  expectOk('adjust(search_v2, 25)', r6)
  if (r6.parsed.traffic_percentage !== 25) throw new Error('expected 25')
  if (r6.parsed.hint !== null) throw new Error('expected null hint at 25%')

  banner('7. adjust_traffic_rollout(search_v2, 100) — hint to promote')
  const r7 = await callTool('adjust_traffic_rollout', {
    feature_id: 'search_v2',
    percentage: 100,
  })
  expectOk('adjust(search_v2, 100)', r7)
  if (!r7.parsed.hint || !r7.parsed.hint.includes("Enabled")) throw new Error('expected promotion hint')

  banner('8. set_feature_state(search_v2, Disabled) — traffic forced to 0')
  const r8 = await callTool('set_feature_state', {
    feature_id: 'search_v2',
    state: 'Disabled',
  })
  expectOk('set_feature_state(search_v2, Disabled)', r8)
  if (r8.parsed.traffic_percentage !== 0) throw new Error('Disabled should force traffic=0')
  if (r8.parsed.warnings.length !== 0) throw new Error('Disabled should have no dependency warnings')

  banner('9. set_feature_state(search_v2, Testing) — traffic kept at 0 → reset to 10')
  const r9 = await callTool('set_feature_state', {
    feature_id: 'search_v2',
    state: 'Testing',
  })
  expectOk('set_feature_state(search_v2, Testing)', r9)
  if (r9.parsed.traffic_percentage !== 10)
    throw new Error('Testing from out-of-range traffic should default to 10, got ' + r9.parsed.traffic_percentage)

  banner('10. set_feature_state(search_v2, lowercase) — INVALID_STATE')
  expectError(
    'set_feature_state(search_v2, enabled)',
    'INVALID_STATE',
    await callTool('set_feature_state', { feature_id: 'search_v2', state: 'enabled' }),
  )

  banner('11. list_features() — 25 entries with minimal fields')
  const r11 = await callTool('list_features', {})
  expectOk('list_features', r11)
  if (!Array.isArray(r11.parsed) || r11.parsed.length !== 25)
    throw new Error('expected 25 entries, got ' + r11.parsed?.length)
  const sample = r11.parsed[0]
  const keys = Object.keys(sample).sort().join(',')
  if (keys !== 'feature_id,name,status,traffic_percentage')
    throw new Error('list_features entry has wrong keys: ' + keys)

  banner('ALL CHECKS PASSED')
} catch (e) {
  console.error('\n[FAIL]', e.message)
  process.exitCode = 1
} finally {
  await client.close()
}
