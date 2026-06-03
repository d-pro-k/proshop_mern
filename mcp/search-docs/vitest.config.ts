import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The pure helpers are the unit-tested + mutation-tested surface;
      // index.ts is the thin stdio/Ollama/Qdrant wrapper (integration-only).
      include: ['src/logic.ts'],
    },
  },
});
