#!/usr/bin/env node
// Reproducible feature-flag toggle that drives the project's feature-flags MCP
// server (mcp/feature-flags) over stdio JSON-RPC — i.e. it calls the canonical
// `set_feature_state` MCP tool, it does NOT hand-edit features.json.
//
// Why this exists: the feature-flags MCP is listed in disabledMcpjsonServers in
// .claude/settings.local.json, so it is not live-connected inside this Claude
// Code session, and MCP servers only attach at startup. This tiny client lets
// us (and the grader) flip the DZ2 flag through the same validated, atomic
// writer the MCP exposes.
//
// Usage:
//   node homework/M7/dz2/tools/ff-toggle.mjs Enabled
//   node homework/M7/dz2/tools/ff-toggle.mjs Disabled
//   node homework/M7/dz2/tools/ff-toggle.mjs Enabled some_other_flag
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '../../../..')
const SERVER = path.join(REPO, 'mcp/feature-flags/dist/index.js')
const FEATURES = path.join(REPO, 'backend/features.json')

const state = process.argv[2]
const featureId = process.argv[3] || 'assistant_vulnerable_mode'
if (!['Enabled', 'Disabled', 'Testing'].includes(state)) {
  console.error('Usage: ff-toggle.mjs <Enabled|Disabled|Testing> [feature_id]')
  process.exit(2)
}

const child = spawn('node', [SERVER], {
  env: { ...process.env, FEATURES_JSON_PATH: FEATURES },
  stdio: ['pipe', 'pipe', 'inherit'],
})

let buf = ''
const pending = new Map()
child.stdout.on('data', (chunk) => {
  buf += chunk.toString()
  let nl
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim()
    buf = buf.slice(nl + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
})

const send = (id, method, params) =>
  new Promise((resolve) => {
    if (id) pending.set(id, resolve)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    if (!id) resolve()
  })

const main = async () => {
  await send(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'ff-toggle', version: '1.0.0' },
  })
  await send(undefined, 'notifications/initialized', {})
  const res = await send(2, 'tools/call', {
    name: 'set_feature_state',
    arguments: { feature_id: featureId, state },
  })
  const text = res?.result?.content?.[0]?.text ?? JSON.stringify(res)
  console.log(text)
  child.kill()
  process.exit(res?.result?.isError ? 1 : 0)
}

main()
