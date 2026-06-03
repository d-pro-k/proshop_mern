import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // bm25.ts is the pure, offline-testable retrieval-scoring logic; the
      // other modules (hybrid/rerank/query/ingest) require live Qdrant + Ollama
      // + a Python venv and are integration-only.
      include: ['bm25.ts'],
    },
  },
});
