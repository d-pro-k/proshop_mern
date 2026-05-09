// Smoke test: spawn the built MCP server as a subprocess via stdio and exercise search_project_docs.
// Prerequisites: Qdrant on :6333, Ollama+bge-m3 on :11434, collection proshop_docs populated (284 points).
// Usage: node smoke-test.mjs

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const transport = new StdioClientTransport({
  command: 'node',
  args: [path.join(__dirname, 'dist/index.js')],
  env: {
    ...process.env,
    QDRANT_URL: 'http://localhost:6333',
    OLLAMA_URL: 'http://localhost:11434',
    COLLECTION: 'proshop_docs',
  },
})

const client = new Client({ name: 'smoke-test', version: '0.0.1' })
await client.connect(transport)

const banner = (s) => console.log('\n=== ' + s + ' ===')

const callTool = async (name, args) => {
  const res = await client.callTool({ name, arguments: args })
  const text = res.content?.[0]?.text ?? ''
  const isError = !!res.isError
  console.log((isError ? '[ERROR]' : '[OK]   ') + ' ' + name + ' ' + JSON.stringify(args))
  if (isError) console.log(text)
  return { isError, text, parsed: text ? JSON.parse(text) : null }
}

const expectOk = (label, r) => {
  if (r.isError) throw new Error(`expected OK but got error in ${label}: ${r.text}`)
}

try {
  // ── 1. tools/list ────────────────────────────────────────────────────────────
  banner('tools/list')
  const tools = await client.listTools()
  console.log(tools.tools.map((t) => t.name).join(', '))
  if (tools.tools.length !== 1) throw new Error('expected 1 tool, got ' + tools.tools.length)
  if (tools.tools[0].name !== 'search_project_docs')
    throw new Error('expected search_project_docs, got ' + tools.tools[0].name)
  const schema = tools.tools[0].inputSchema
  const props = schema?.properties ?? {}
  for (const key of ['query', 'top_k', 'filter_type', 'filter_source_file']) {
    if (!props[key]) throw new Error(`inputSchema missing property: ${key}`)
  }
  if (schema?.required && schema.required.includes('filter_type'))
    throw new Error('filter_type should be optional (not in required)')
  if (schema?.required && schema.required.includes('filter_source_file'))
    throw new Error('filter_source_file should be optional (not in required)')
  console.log('tools/list OK — 1 tool, schema properties correct')

  // ── 2. Filtered: Q1 — ADR about DB choice ────────────────────────────────────
  banner('2. filtered Q1 — adr (DB choice)')
  const r2 = await callTool('search_project_docs', {
    query: 'Какая БД используется в proshop_mern и почему именно она?',
    top_k: 3,
    filter_type: 'adr',
  })
  expectOk('filtered Q1', r2)
  if (!Array.isArray(r2.parsed)) throw new Error('result must be an array')
  if (r2.parsed.length === 0) throw new Error('expected non-empty results')
  const top1Q1 = r2.parsed[0]
  if (!top1Q1.source_file.includes('adr-001-mongodb'))
    throw new Error(`Q1 filtered top-1 expected adr-001-mongodb, got: ${top1Q1.source_file}`)
  console.log(`top-1: ${top1Q1.source_file} (score ${top1Q1.score?.toFixed(4)})`)

  // ── 3. Filtered: Q2 — spec for payment_stripe_v3 dependencies ────────────────
  banner('3. filtered Q2 — spec (payment_stripe_v3)')
  const r3 = await callTool('search_project_docs', {
    query: 'Какие фичи зависят от payment_stripe_v3?',
    top_k: 3,
    filter_type: 'spec',
  })
  expectOk('filtered Q2', r3)
  if (!Array.isArray(r3.parsed) || r3.parsed.length === 0) throw new Error('expected results')
  const top1Q2 = r3.parsed[0]
  if (!top1Q2.source_file.includes('feature-flags-spec'))
    throw new Error(`Q2 filtered top-1 expected feature-flags-spec, got: ${top1Q2.source_file}`)
  console.log(`top-1: ${top1Q2.source_file} (score ${top1Q2.score?.toFixed(4)})`)

  // ── 4. Filtered: Q3 — incident with checkout ─────────────────────────────────
  banner('4. filtered Q3 — incident (checkout)')
  const r4 = await callTool('search_project_docs', {
    query: 'Что случилось во время последнего incident с checkout?',
    top_k: 3,
    filter_type: 'incident',
  })
  expectOk('filtered Q3', r4)
  if (!Array.isArray(r4.parsed) || r4.parsed.length === 0) throw new Error('expected results')
  const top1Q3 = r4.parsed[0]
  if (!top1Q3.source_file.startsWith('incidents/'))
    throw new Error(`Q3 filtered top-1 expected incidents/*, got: ${top1Q3.source_file}`)
  console.log(`top-1: ${top1Q3.source_file} (score ${top1Q3.score?.toFixed(4)})`)

  // ── 5. Vanilla: no filter — non-empty, semantically relevant ─────────────────
  banner('5. vanilla Q1 — no filter (DB choice)')
  const r5 = await callTool('search_project_docs', {
    query: 'Какая БД используется в proshop_mern и почему именно она?',
    top_k: 5,
  })
  expectOk('vanilla Q1', r5)
  if (!Array.isArray(r5.parsed) || r5.parsed.length !== 5)
    throw new Error(`expected 5 results, got ${r5.parsed?.length}`)
  const top3Files = r5.parsed.slice(0, 3).map((h) => h.source_file)
  console.log('top-3 source_files:', top3Files)
  const relevantFiles = ['dev-history.md', 'architecture.md', 'adr-001-mongodb-vs-postgres.md']
  const hasRelevant = top3Files.some((f) => relevantFiles.some((rel) => f.includes(rel)))
  if (!hasRelevant)
    throw new Error(
      `vanilla Q1: expected one of ${relevantFiles.join(', ')} in top-3, got: ${top3Files.join(', ')}`,
    )

  // ── 6. Response shape ─────────────────────────────────────────────────────────
  banner('6. response shape validation')
  const sample = r2.parsed[0]
  const requiredKeys = ['source_file', 'file_path', 'title', 'parent_headings', 'score', 'snippet']
  for (const key of requiredKeys) {
    if (!(key in sample)) throw new Error(`result item missing key: ${key}`)
  }
  if (typeof sample.snippet !== 'string' || sample.snippet.length > 200)
    throw new Error(`snippet must be string ≤200 chars, got length ${sample.snippet?.length}`)
  if (!Array.isArray(sample.parent_headings))
    throw new Error('parent_headings must be an array')
  console.log('shape OK — all 6 keys present, snippet ≤200, parent_headings is array')

  banner('ALL CHECKS PASSED')
} catch (e) {
  console.error('\n[FAIL]', e.message)
  process.exitCode = 1
} finally {
  await client.close()
}
