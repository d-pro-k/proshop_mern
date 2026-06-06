import { defineConfig } from 'vitest/config';

// Backend characterization-test harness (Stage 2 safe-refactor fixes).
// The backend is ESM and shares the root package.json; tests live in the
// submission folder and exercise controllers/middleware with mocked models.
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'homework/M6/stage2-fix-top3/tests/**/*.test.js',
      'homework/M7/tests/**/*.test.js',
    ],
  },
});
