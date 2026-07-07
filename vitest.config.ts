import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // No test files exist yet this early in Plan 1; without this, `vitest run`
    // exits 1 on zero tests and would fail CI for every PR until real tests land.
    // TODO(remove once first *.test.ts lands, no later than Task 11's permanent
    // parseListing fixture): a silent glob/rename regression to zero discovered
    // tests would otherwise report green instead of failing loudly.
    passWithNoTests: true,
  },
})
