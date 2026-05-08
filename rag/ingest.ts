import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import { QdrantClient } from '@qdrant/js-client-rest';

type ChunkMetadata = {
  file_path: string;
  keywords: string[];
  language: string;
  parent_headings: string[];
  source_file: string;
  summary: string;
  title: string;
  type: string;
};

type ChunkRecord = {
  metadata: ChunkMetadata;
  text: string;
};

type IndexedChunk = ChunkRecord & {
  localIndex: number;
};

type PointPayload = ChunkMetadata & {
  text: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNKS_PATH = path.resolve(__dirname, 'chunks.jsonl');
const COLLECTION_NAME = 'proshop_docs';
const QDRANT_URL = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'bge-m3';
const VECTOR_SIZE = 1024;
const BATCH_SIZE = 16;

const qdrant = new QdrantClient({ url: QDRANT_URL });

function pointId(sourceFile: string, localChunkIndex: number): string {
  const digest = createHash('md5')
    .update(`${sourceFile}:${localChunkIndex}`)
    .digest('hex');

  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

function indexChunksBySource(chunks: ChunkRecord[]): IndexedChunk[] {
  const counters = new Map<string, number>();

  return chunks.map((chunk) => {
    const sourceFile = chunk.metadata.source_file;
    const next = counters.get(sourceFile) ?? 0;
    counters.set(sourceFile, next + 1);

    return { ...chunk, localIndex: next };
  });
}

async function readChunks(): Promise<ChunkRecord[]> {
  const stream = createReadStream(CHUNKS_PATH, { encoding: 'utf8' });
  const rl = readline.createInterface({
    crlfDelay: Infinity,
    input: stream,
  });

  const chunks: ChunkRecord[] = [];

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    const chunk = JSON.parse(line) as ChunkRecord;
    chunks.push(chunk);
  }

  return chunks;
}

async function ensureCollection(): Promise<void> {
  await qdrant.recreateCollection(COLLECTION_NAME, {
    vectors: {
      size: VECTOR_SIZE,
      distance: 'Cosine',
    },
  });
}

async function embed(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama embeddings failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { embedding?: number[] };

  if (!data.embedding || data.embedding.length !== VECTOR_SIZE) {
    throw new Error(`Unexpected embedding size: ${data.embedding?.length ?? 'missing'} (expected ${VECTOR_SIZE})`);
  }

  return data.embedding;
}

function buildEmbeddingText(chunk: ChunkRecord): string {
  const parts = [
    chunk.metadata.title,
    chunk.metadata.parent_headings.join(' > '),
    chunk.metadata.keywords.join(', '),
    chunk.metadata.summary,
    chunk.text,
  ];

  return parts.filter(Boolean).join('\n\n');
}

async function upsertBatch(batch: IndexedChunk[]): Promise<void> {
  const vectors = await Promise.all(
    batch.map((chunk) => embed(buildEmbeddingText(chunk))),
  );

  const points = batch.map((chunk, offset) => {
    const payload: PointPayload = {
      ...chunk.metadata,
      text: chunk.text,
    };

    return {
      id: pointId(chunk.metadata.source_file, chunk.localIndex),
      vector: vectors[offset],
      payload,
    };
  });

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,
    points,
  });
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const rawChunks = await readChunks();

  if (rawChunks.length === 0) {
    throw new Error(`No chunks found in ${CHUNKS_PATH}`);
  }

  const chunks = indexChunksBySource(rawChunks);
  console.log(`Loaded ${chunks.length} chunks from ${CHUNKS_PATH}`);

  await ensureCollection();
  console.log(`Recreated collection "${COLLECTION_NAME}" with size=${VECTOR_SIZE}, distance=Cosine`);

  for (let index = 0; index < chunks.length; index += BATCH_SIZE) {
    const batch = chunks.slice(index, index + BATCH_SIZE);
    await upsertBatch(batch);

    const processed = index + batch.length;
    const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[${processed}/${chunks.length}] elapsed=${elapsedSeconds}s`);
  }

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`complete: upserted ${chunks.length} chunks in ${elapsedSeconds}s`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
