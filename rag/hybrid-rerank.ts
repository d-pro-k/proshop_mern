import { fileURLToPath } from 'node:url'

import { QdrantClient } from '@qdrant/js-client-rest'

import { bm25Sparse } from './bm25.js'
import { rerank } from './rerank.js'

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

export const searchHybridReranked = async (query: string, topK = 5) => {
  // 1. Hybrid retrieval — large pool for reranker
  const dense = await embedDense(query)
  const sparse = bm25Sparse(query)
  const hybridRes = await client.query(COLLECTION, {
    prefetch: [
      { query: dense, using: 'dense', limit: 25 },
      { query: { indices: sparse.indices, values: sparse.values }, using: 'sparse', limit: 25 },
    ],
    query: { fusion: 'rrf' },
    limit: 25,
    with_payload: true,
  })

  // 2. Prepare candidates for reranker
  const candidates = hybridRes.points.map((p) => ({
    id: String(p.id),
    text: (p.payload?.text as string) ?? '',
  }))

  // 3. Rerank
  const reranked = await rerank(query, candidates)

  // 4. Take top-K, restore payload by id
  const idToPoint = new Map(hybridRes.points.map((p) => [String(p.id), p]))
  return reranked.slice(0, topK).map((r) => {
    const p = idToPoint.get(r.id)!
    return {
      score: r.score,
      source_file: p.payload?.source_file,
      title: p.payload?.title,
      snippet: ((p.payload?.text as string) ?? '').slice(0, 200),
    }
  })
}

// CLI entry
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const query = process.argv[2]
  if (!query) {
    console.error('Usage: npx tsx rag/hybrid-rerank.ts "<query>"')
    process.exit(1)
  }
  console.log(JSON.stringify(await searchHybridReranked(query), null, 2))
}
