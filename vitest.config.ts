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
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` resolves to a module that throws on import outside a
      // Server Component. Under Node it picks the browser entry and takes
      // every server module down with it, so it is stubbed here. The guarantee
      // it provides is a build-time one that Next enforces; nothing is lost by
      // neutering it in a test runner.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    // Playwright owns tests/e2e; Vitest must not try to run those.
    include: ['tests/unit/**/*.test.ts'],
  },
});
