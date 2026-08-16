import { createHmac, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { loadEnv } from '../config/env'

/**
 * Signs artifact stream URLs.
 *
 * The stream endpoint cannot require a bearer token: the URL is handed to the
 * platform's own downloader (Android's DownloadManager, or Safari for an
 * itms-services manifest), and neither replays our Authorization header. The
 * capability therefore has to travel in the URL itself.
 *
 * So the ticket carries a short-lived HMAC over (artifactId, orgId, expiry).
 * The stream route is @Public() to the guard stack but useless without a valid
 * signature, and the signature pins the org so a leaked link cannot be replayed
 * against another tenant's artifact id.
 */
@Injectable()
export class DownloadSigner {
  private readonly secret = loadEnv(process.env).JWT_SECRET
  /** Long enough for a slow mobile download to start, short enough to not be a share link. */
  static readonly TTL_SECONDS = 15 * 60

  sign(artifactId: string, orgId: string, expiresAt: number): string {
    return createHmac('sha256', this.secret)
      .update(`${artifactId}.${orgId}.${expiresAt}`)
      .digest('hex')
  }

  issue(artifactId: string, orgId: string): { expiresAt: number; signature: string } {
    const expiresAt = Math.floor(Date.now() / 1000) + DownloadSigner.TTL_SECONDS
    return { expiresAt, signature: this.sign(artifactId, orgId, expiresAt) }
  }

  verify(
    artifactId: string,
    orgId: string,
    expiresAt: number,
    signature: string,
  ): boolean {
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return false
    }

    const expected = Buffer.from(this.sign(artifactId, orgId, expiresAt))
    const actual = Buffer.from(signature)
    // Length check first: timingSafeEqual throws on a length mismatch.
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  }
}
