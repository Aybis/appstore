import 'reflect-metadata'
import { readFileSync } from 'node:fs'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { loadEnv, trustProxySetting } from './config/env'

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env)

  /*
   * Serving TLS from this process is the alternative to terminating it at a
   * proxy, not a replacement for it. A LAN-hosted internal store has no public
   * DNS to answer an ACME challenge, and one process holding a certificate is
   * simpler than a second component to keep alive.
   *
   * Read synchronously and before anything else starts: a missing key should
   * stop the process here, not surface as a connection reset later.
   */
  const httpsOptions =
    env.TLS_CERT && env.TLS_KEY
      ? { cert: readFileSync(env.TLS_CERT), key: readFileSync(env.TLS_KEY) }
      : undefined

  const app = await NestFactory.create(AppModule, httpsOptions ? { httpsOptions } : {})
  const log = new Logger('bootstrap')

  /*
   * TLS is terminated in front of this process in any real deployment
   * (security review S-6), and Express has to be told so. Until it is,
   * `req.ips` is empty and `req.protocol` reads http, which silently turns the
   * per-IP rate limit into one global budget and writes http:// URLs into the
   * iOS install manifest that iOS then refuses.
   *
   * Trusting by default would be worse than not trusting: with nothing setting
   * X-Forwarded-For, any caller could spoof an address and evade the limit.
   */
  const trustProxy = trustProxySetting(env.TRUST_PROXY)
  if (trustProxy !== false) {
    const instance = app.getHttpAdapter().getInstance() as {
      set(key: string, value: unknown): unknown
    }
    instance.set('trust proxy', trustProxy)
    log.log(`Trusting proxy headers: ${JSON.stringify(trustProxy)}`)
  }

  // Explicit allowlist, never `enableCors()` bare — that reflects any origin
  // that asks. With no CORS_ORIGINS set, no browser client is permitted, which
  // is the right default for an API only mobile apps call.
  if (env.CORS_ORIGINS.length > 0) {
    app.enableCors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      // X-Auth-Mode is how a browser asks for its refresh token to be put in
      // an httpOnly cookie instead of the response body. Without it here the
      // preflight fails and the console silently falls back to no auth at all.
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Auth-Mode'],
    })
  }
  // `download/:artifactId/stream` sits outside the versioned prefix: the URL is
  // embedded in a signed ticket and handed to the platform downloader, so it is
  // a stable capability URL rather than part of the REST surface.
  app.setGlobalPrefix('v1', { exclude: [
      'health',
      'download/:artifactId/stream',
      'download/:artifactId/manifest.plist',
    ] })
  await app.listen(env.PORT)
  log.log(`API listening on port ${env.PORT} over ${httpsOptions ? 'https' : 'http'}`)

  /*
   * Said loudly rather than left to a document nobody rereads. Without TLS the
   * refresh cookie cannot carry `Secure`, iOS refuses to install at all, and
   * every Android release build needs the cleartext exemption that app.json
   * records as a temporary risk.
   */
  const publicBase = process.env.PUBLIC_BASE_URL
  const secureCookie = env.COOKIE_SECURE ?? env.NODE_ENV === 'production'

  if (!httpsOptions && publicBase && !publicBase.startsWith('https://')) {
    log.warn(
      `PUBLIC_BASE_URL is ${publicBase} — not HTTPS. iOS installs will fail and the refresh cookie cannot be Secure (S-6).`,
    )
  }
  if (env.NODE_ENV === 'production' && !secureCookie) {
    log.warn(
      'Running in production without COOKIE_SECURE. The refresh cookie is being sent over plain HTTP (S-6).',
    )
  }
  if (env.NODE_ENV === 'production' && trustProxy === false) {
    log.warn(
      'TRUST_PROXY is unset in production. Behind a TLS-terminating proxy every caller shares one rate-limit bucket and manifest URLs will say http.',
    )
  }
}

void bootstrap()
