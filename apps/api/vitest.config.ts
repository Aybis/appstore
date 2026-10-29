import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    globalSetup: ['./test/support/postgres.global.ts'],
    // Tests write builds and icons. Pinned to the local disk so a shell or
    // .env with R2 credentials can never make a test run fill the real bucket.
    env: { BLOB_STORE: 'fs' },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
})
