import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The pure decision logic is the unit-tested + mutation-tested surface;
      // index.ts is the thin stdio/fs wrapper (integration-only).
      include: ['src/logic.ts'],
    },
  },
});
