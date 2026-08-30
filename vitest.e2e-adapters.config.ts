import { defineConfig } from 'vitest/config';

// Separate config for adapter tests that touch a real filesystem/browser/subprocess.
// Kept out of the default `npm test` run (see vitest.config.ts) so that command
// stays fast and runnable with zero installed browsers. Invoked explicitly via
// `npm run test:e2e-adapters`.
export default defineConfig({
  test: {
    include: ['test/e2e-adapters/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
