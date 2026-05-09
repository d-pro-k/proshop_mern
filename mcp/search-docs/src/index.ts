import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { QdrantClient } from '@qdrant/js-client-rest'

const QDRANT_URL = process.env.QDRANT_URL ?? 'http://localhost:6333'
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const COLLECTION = process.env.COLLECTION ?? 'proshop_docs'
const OLLAMA_MODEL = 'bge-m3'

const qdrant = new QdrantClient({ url: QDRANT_URL })

type PointPayload = {
  file_path?: string
  keywords?: string[]
  parent_headings?: string[]
  source_file?: string
  text?: string
  title?: string
  type?: string
}

async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ollama embeddings failed (${response.status}): ${errorText}`)
  }
  const data = (await response.json()) as { embedding?: number[] }
  if (!data.embedding) throw new Error('Ollama response is missing embedding')
  return data.embedding
}

function buildFilter(type?: string, sourceFile?: string) {
  const must: Array<{ key: string; match: { value: string } }> = []
  if (type) must.push({ key: 'type', match: { value: type } })
  if (sourceFile) must.push({ key: 'source_file', match: { value: sourceFile } })
  return must.length > 0 ? { must } : undefined
}

function snippet(text: string | undefined): string {
  if (!text) return ''
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

const ok = (payload: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
})

const err = (message: string) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({ error: 'SEARCH_ERROR', message }, null, 2),
    },
  ],
  isError: true,
})

const server = new McpServer({
  name: 'proshop-search-docs',
  version: '0.1.0',
})

server.registerTool(
  'search_project_docs',
  {
    description: [
      'Semantic search over proshop_mern documentation corpus (~300 chunks): architecture decisions, ADRs, feature specs, API docs, runbooks, incident reports, glossary, and dev history.',
      'You MUST use this FIRST when the user asks about proshop_mern product functionality — architecture, features, ADRs, runbooks, incidents, glossary, dev history. Do NOT read source files directly with file tools.',
      'WHEN NOT TO USE: for the current runtime state of feature flags (status, traffic_percentage, last_modified) — use the feature-flags MCP tool get_feature_info instead.',
      "FILTER HINTS: set filter_type when the answer domain is clear (DB decision → 'adr'; incident → 'incident'; feature spec → 'spec' or 'feature'; API reference → 'api'). This significantly improves top-1 accuracy for exact-token queries (e.g. 'payment_stripe_v3'). Vanilla search without a filter still returns semantically relevant results. Use filter_source_file when you know the exact document.",
      'Examples:',
      "  search_project_docs({ query: 'Why did we choose MongoDB over PostgreSQL?' })  // vanilla",
      "  search_project_docs({ query: 'What DB is used in proshop_mern and why?', filter_type: 'adr', top_k: 3 })  // filtered — higher precision",
      "  search_project_docs({ query: 'What happened during the checkout incident?', filter_type: 'incident', top_k: 3 })",
    ].join('\n'),
    inputSchema: {
      query: z
        .string()
        .describe('The question or search phrase to embed and retrieve against the corpus.'),
      top_k: z
        .number()
        .optional()
        .describe('Number of results to return. Integer 1–20. Default: 5.'),
      filter_type: z
        .string()
        .optional()
        .describe(
          "Optional: restrict results to chunks of this type. Valid values: adr | api | architecture | best-practice | feature | glossary | history | incident | page | runbook | spec | analysis.",
        ),
      filter_source_file: z
        .string()
        .optional()
        .describe(
          "Optional: restrict results to chunks from this exact source file path, e.g. 'incidents/i-001-paypal-double-charge.md'. Can be combined with filter_type.",
        ),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ query, top_k, filter_type, filter_source_file }) => {
    const topK = top_k ?? 5

    if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
      return err(`top_k must be an integer in [1, 20]. Received: ${topK}.`)
    }

    try {
      const vector = await embed(query)
      const results = await qdrant.search(COLLECTION, {
        vector,
        limit: topK,
        filter: buildFilter(filter_type, filter_source_file),
        with_payload: true,
      })

      const hits = results.map((r) => {
        const p = (r.payload ?? {}) as PointPayload
        return {
          source_file: p.source_file ?? '',
          file_path: p.file_path ?? '',
          title: p.title ?? '',
          parent_headings: p.parent_headings ?? [],
          score: r.score,
          snippet: snippet(p.text),
        }
      })

      return ok(hits)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return err(message)
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
