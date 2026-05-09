import { fileURLToPath } from 'node:url'

import { QdrantClient } from '@qdrant/js-client-rest'
import { bm25Sparse } from './bm25.js'

const COLLECTION = 'proshop_docs_hybrid'
const QDRANT_URL = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333'
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'bge-m3'

const client = new QdrantClient({ url: QDRANT_URL })

async function embedDense(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  })
  if (!response.ok) throw new Error(`Ollama embeddings failed (${response.status}): ${await response.text()}`)
  const data = (await response.json()) as { embedding?: number[] }
  if (!data.embedding) throw new Error('Ollama response is missing embedding')
  return data.embedding
}

export const searchHybrid = async (query: string, topK = 5) => {
  const dense = await embedDense(query)
  const sparse = bm25Sparse(query)

  const res = await client.query(COLLECTION, {
    prefetch: [
      { query: dense, using: 'dense', limit: 25 },
      { query: { indices: sparse.indices, values: sparse.values }, using: 'sparse', limit: 25 },
    ],
    query: { fusion: 'rrf' },
    limit: topK,
    with_payload: true,
  })

  return res.points.map((p) => ({
    score: p.score,
    source_file: p.payload?.source_file,
    title: p.payload?.title,
    type: p.payload?.type,
    snippet: ((p.payload?.text as string) ?? '').replace(/\s+/g, ' ').trim().slice(0, 200),
  }))
}

// CLI entry
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const query = process.argv[2]
  if (!query) {
    console.error('Usage: npx tsx rag/hybrid.ts "<query>"')
    process.exit(1)
  }
  const topK = process.argv[3] ? Number(process.argv[3]) : 5
  searchHybrid(query, topK)
    .then((results) => console.log(JSON.stringify(results, null, 2)))
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
