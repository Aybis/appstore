import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => {
  // Opt-in: DEV_API_PROXY=https://maya-api.muchtar.dev pnpm --filter @appstore/console dev
  // sends /v1, /download and /health through Vite, like the Vercel rewrites do in
  // production. The browser then sees one origin, so the API needs no CORS entry for
  // localhost and the SameSite=Strict refresh cookie keeps working. Pair it with
  // VITE_API_BASE_URL= (empty) so the console calls this origin instead of :3000.
  const proxyTarget = loadEnv(mode, '.', '').DEV_API_PROXY
  const proxy = proxyTarget
    ? Object.fromEntries(
        ['/v1', '/download', '/health'].map((path) => [
          path,
          { target: proxyTarget, changeOrigin: true, secure: true },
        ]),
      )
    : undefined

  // Source maps go to Sentry and nowhere else: built as 'hidden' (no
  // sourceMappingURL comment in the bundle), uploaded, then deleted from dist
  // so Vercel never serves the original source. Skipped entirely without a
  // token, which keeps local and preview builds free of any Sentry step.
  const sentryToken = process.env.SENTRY_AUTH_TOKEN
  const sentry = sentryToken
    ? sentryVitePlugin({
        authToken: sentryToken,
        org: process.env.SENTRY_ORG ?? 'aybis',
        project: process.env.SENTRY_PROJECT ?? 'maya-console',
        release: { name: process.env.VERCEL_GIT_COMMIT_SHA },
        sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        telemetry: false,
      })
    : null

  return {
    plugins: [react(), ...(sentry ? [sentry] : [])],
    // react-router 7 ships syntax esbuild refuses to downlevel to Vite's default
    // dep-optimizer baseline (es2020 / safari14), which fails the prebundle with
    // "Transforming destructuring ... is not supported yet". The console is an
    // internal tool on current browsers, so raising the floor is the right fix
    // rather than pinning an older router.
    esbuild: { target: 'es2022' },
    optimizeDeps: { esbuildOptions: { target: 'es2022' } },
    build: { target: 'es2022', sourcemap: sentry ? 'hidden' : false },
    server: {
      port: 5173,
      // Bound to all interfaces so the console is reachable from the same LAN the
      // emulator and any test device already use to reach the API.
      host: true,
      proxy,
    },
  }
})
