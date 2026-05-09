import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

import { QdrantClient } from '@qdrant/js-client-rest'
import { bm25Sparse } from './bm25.js'

type ChunkMetadata = {
  file_path: string
  keywords: string[]
  language: string
  parent_headings: string[]
  source_file: string
  summary: string
  title: string
  type: string
}

type ChunkRecord = {
  metadata: ChunkMetadata
  text: string
}

type IndexedChunk = ChunkRecord & {
  localIndex: number
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CHUNKS_PATH = path.resolve(__dirname, 'chunks.jsonl')
const COLLECTION = 'proshop_docs_hybrid'
const QDRANT_URL = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333'
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'bge-m3'
const VECTOR_SIZE = 1024
const BATCH_SIZE = 16

const client = new QdrantClient({ url: QDRANT_URL })

function pointId(sourceFile: string, localChunkIndex: number): string {
  const digest = createHash('md5').update(`${sourceFile}:${localChunkIndex}`).digest('hex')
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`
}

function indexChunksBySource(chunks: ChunkRecord[]): IndexedChunk[] {
  const counters = new Map<string, number>()
  return chunks.map((chunk) => {
    const sourceFile = chunk.metadata.source_file
    const next = counters.get(sourceFile) ?? 0
    counters.set(sourceFile, next + 1)
    return { ...chunk, localIndex: next }
  })
}

async function readChunks(): Promise<ChunkRecord[]> {
  const stream = createReadStream(CHUNKS_PATH, { encoding: 'utf8' })
  const rl = readline.createInterface({ crlfDelay: Infinity, input: stream })
  const chunks: ChunkRecord[] = []
  for await (const line of rl) {
    if (line.trim()) chunks.push(JSON.parse(line) as ChunkRecord)
  }
  return chunks
}

// Same enriched text as ingest.ts for consistent dense retrieval quality
function buildEmbeddingText(chunk: ChunkRecord): string {
  const parts = [
    chunk.metadata.title,
    chunk.metadata.parent_headings.join(' > '),
    chunk.metadata.keywords.join(', '),
    chunk.metadata.summary,
    chunk.text,
  ]
  return parts.filter(Boolean).join('\n\n')
}

async function embedDense(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: text }),
  })
  if (!response.ok) throw new Error(`Ollama embeddings failed (${response.status}): ${await response.text()}`)
  const data = (await response.json()) as { embedding?: number[] }
  if (!data.embedding || data.embedding.length !== VECTOR_SIZE) {
    throw new Error(`Unexpected embedding size: ${data.embedding?.length ?? 'missing'} (expected ${VECTOR_SIZE})`)
  }
  return data.embedding
}

async function upsertBatch(batch: IndexedChunk[]): Promise<void> {
  const denseVecs = await Promise.all(batch.map((c) => embedDense(buildEmbeddingText(c))))
  const points = batch.map((c, j) => ({
    id: pointId(c.metadata.source_file, c.localIndex),
    vector: {
      dense: denseVecs[j],
      sparse: bm25Sparse(buildEmbeddingText(c)),
    },
    payload: { ...c.metadata, text: c.text },
  }))
  await client.upsert(COLLECTION, { wait: true, points })
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  const rawChunks = await readChunks()

  if (rawChunks.length === 0) throw new Error(`No chunks found in ${CHUNKS_PATH}`)

  const chunks = indexChunksBySource(rawChunks)
  console.log(`Loaded ${chunks.length} chunks from ${CHUNKS_PATH}`)

  await client.recreateCollection(COLLECTION, {
    vectors: { dense: { size: VECTOR_SIZE, distance: 'Cosine' } },
    sparse_vectors: { sparse: { modifier: 'idf' } },
  })
  console.log(`Recreated collection "${COLLECTION}" with named dense + sparse vectors`)

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    await upsertBatch(batch)
    const processed = i + batch.length
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(`[${processed}/${chunks.length}] elapsed=${elapsed}s`)
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`Hybrid ingest complete: upserted ${chunks.length} chunks in ${elapsed}s`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
