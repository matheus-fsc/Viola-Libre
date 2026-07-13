import { defineConfig } from 'vitest/config';

// Standalone test config so the pure-TS engine tests run in a plain Node environment,
// without loading the app's React / Tailwind Vite plugins.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
