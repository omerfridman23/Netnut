import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.spec.ts', 'src/**/*.spec.ts'],
    // E2E/concurrency tests boot a Nest app and hit a real SQLite file; give them room.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Run test files sequentially so concurrency tests own the database deterministically.
    fileParallelism: false,
  },
  plugins: [
    // SWC compiles TS decorators + emits metadata that Nest's DI relies on.
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
