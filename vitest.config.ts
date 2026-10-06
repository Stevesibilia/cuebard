import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  // Nuxt replaces this at build time; tests import composables directly
  define: {
    'import.meta.client': 'true',
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
