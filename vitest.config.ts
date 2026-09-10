import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * No Vite plugins on purpose.
 *
 * `@vitejs/plugin-react` and `vite-tsconfig-paths` currently resolve a newer
 * Vite than Vitest itself uses, and the two `Plugin` types are structurally
 * incompatible — the config stops typechecking. These tests exercise schemas
 * and message catalogues rather than components, so neither plugin earns its
 * conflict. Add the React plugin back, pinned to Vitest's Vite major, when
 * component tests arrive in Phase 2.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    globals: true,
    // Playwright owns tests/e2e; Vitest must not try to run those.
    include: ['tests/unit/**/*.test.ts'],
  },
});
