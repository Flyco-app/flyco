import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/env/schema.ts', 'src/lib/observability/options.ts'],
      thresholds: { lines: 90, functions: 100, statements: 90, branches: 85 },
    },
  },
});
