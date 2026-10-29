import * as Sentry from '@sentry/nestjs'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

/*
 * Sentry has to patch `http`, `express` and `postgres` before they are first
 * required, so this file is imported on the first line of main.ts — ahead of
 * reflect-metadata and AppModule — and reads process.env directly rather than
 * going through loadEnv, which pulls in modules Sentry needs to see load.
 *
 * Off without SENTRY_DSN: tests, local runs and a fresh clone send nothing.
 *
 * What the traces cover, since only the API talks to the other services:
 *   - Supabase: every query through postgres.js is a span inside its request.
 *   - Cloudflare R2: the S3 client's HTTPS calls are spans too.
 */
const dsn = process.env.SENTRY_DSN

const rate = (value: string | undefined, fallback: number): number => {
  // Empty means "not set", not 0 — Number('') is 0 and would switch tracing off.
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback
}

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    // Render sets this to the deployed commit, which ties an error to a build.
    release: process.env.SENTRY_RELEASE || undefined,
    integrations: [Sentry.postgresJsIntegration(), nodeProfilingIntegration()],
    // 100% while traffic is a handful of people; lower it with the env var once
    // the quota starts to matter.
    tracesSampleRate: rate(process.env.SENTRY_TRACES_SAMPLE_RATE, 1.0),
    profileSessionSampleRate: rate(process.env.SENTRY_PROFILE_SAMPLE_RATE, 1.0),
    profileLifecycle: 'trace',
    // This SDK collects bodies, cookies, query values and local variables by
    // default. Here that would mean login passwords, password hashes and
    // refresh-token hashes bound into queries, the bearer token and the refresh
    // cookie. None of that should leave this process; the shape of a request
    // (route, status, timing, the SQL text itself) is enough to debug with.
    dataCollection: {
      httpBodies: [],
      cookies: false,
      httpHeaders: {
        request: { deny: ['authorization', 'cookie', 'x-api-key'] },
        response: { deny: ['set-cookie'] },
      },
      databaseQueryData: false,
      stackFrameVariables: false,
    },
  })
}
