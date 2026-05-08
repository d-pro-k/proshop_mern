import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { QdrantClient } from '@qdrant/js-client-rest';

type SearchOptions = {
  sourceFile?: string;
  topK: number;
  type?: string;
};

type PointPayload = {
  file_path?: string;
  keywords?: string[];
  language?: string;
  parent_headings?: string[];
  source_file?: string;
  summary?: string;
  text?: string;
  title?: string;
  type?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLLECTION_NAME = 'proshop_docs';
const QDRANT_URL = process.env.QDRANT_URL ?? 'http://127.0.0.1:6333';
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'bge-m3';
const qdrant = new QdrantClient({ url: QDRANT_URL });

function parseArgs(argv: string[]): { query: string; options: SearchOptions } {
  const positional: string[] = [];
  const options: SearchOptions = {
    topK: 5,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--top-k') {
      options.topK = Number(argv[index + 1] ?? 5);
      index += 1;
      continue;
    }

    if (arg === '--type') {
      options.type = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--source-file') {
      options.sourceFile = argv[index + 1];
      index += 1;
      continue;
    }

    positional.push(arg);
  }

  const query = positional.join(' ').trim();

  if (!query) {
    throw new Error('Usage: npx tsx query.ts "<question>" [--top-k 5] [--type feature] [--source-file features/payments.md]');
  }

  if (!Number.isFinite(options.topK) || options.topK <= 0) {
    throw new Error(`Invalid --top-k value: ${options.topK}`);
  }

  return { query, options };
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

  if (!data.embedding) {
    throw new Error('Ollama response is missing embedding');
  }

  return data.embedding;
}

function buildFilter(options: SearchOptions) {
  const must: Array<{ key: string; match: { value: string } }> = [];

  if (options.type) {
    must.push({
      key: 'type',
      match: { value: options.type },
    });
  }

  if (options.sourceFile) {
    must.push({
      key: 'source_file',
      match: { value: options.sourceFile },
    });
  }

  return must.length > 0 ? { must } : undefined;
}

function snippet(text: string | undefined): string {
  if (!text) {
    return '';
  }

  return text.replace(/\s+/g, ' ').trim().slice(0, 200);
}

async function search(query: string, options: SearchOptions) {
  const vector = await embed(query);
  return qdrant.search(COLLECTION_NAME, {
    vector,
    limit: options.topK,
    filter: buildFilter(options),
    with_payload: true,
  });
}

async function main(): Promise<void> {
  const { query, options } = parseArgs(process.argv.slice(2));
  const results = await search(query, options);

  console.log(`Query: ${query}`);
  console.log(`Top K: ${options.topK}`);

  if (options.type) {
    console.log(`Type filter: ${options.type}`);
  }

  if (options.sourceFile) {
    console.log(`Source file filter: ${options.sourceFile}`);
  }

  console.log('');

  results.forEach((result, index) => {
    const payload = (result.payload ?? {}) as PointPayload;
    console.log(`[${index + 1}] score=${result.score?.toFixed(4) ?? 'n/a'}`);
    console.log(`source_file: ${payload.source_file ?? 'n/a'}`);
    console.log(`title: ${payload.title ?? 'n/a'}`);
    console.log(`type: ${payload.type ?? 'n/a'}`);
    console.log(`snippet: ${snippet(payload.text)}`);
    console.log('');
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
