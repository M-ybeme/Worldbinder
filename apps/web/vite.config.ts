import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  // @worldbinder/contracts and @worldbinder/validation are CommonJS (they're
  // also consumed by the CJS NestJS API/worker, so they can't switch to ESM
  // without a much larger change there). Vite doesn't pre-bundle pnpm
  // workspace-linked packages by default, so without this it serves their
  // dist/index.js raw via /@fs/ and native ESM import of that CJS output
  // can't reliably detect named exports ("does not provide an export named
  // ..."). Forcing them through esbuild's CJS->ESM interop fixes it.
  optimizeDeps: {
    include: ['@worldbinder/contracts', '@worldbinder/validation'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // Vitest's default include glob also matches e2e/*.spec.ts — exclude it,
    // those run under Playwright (`pnpm test:e2e`), not Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
