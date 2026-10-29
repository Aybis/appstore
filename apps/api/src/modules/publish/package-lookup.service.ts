import { Injectable, Logger } from '@nestjs/common'

/** Apple's public lookup. No key, no quota worth worrying about at this rate. */
const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup'

/** A public store cannot be allowed to make publishing hang. */
const TIMEOUT_MS = 2500

export interface PublicAppMatch {
  store: 'apple'
  name: string
  seller: string
  url: string
}

export interface PackageLookup {
  /** Null when nothing matched, or when the check could not be run. */
  match: PublicAppMatch | null
  /**
   * True when the lookup itself failed — offline, rate-limited, timed out.
   *
   * Reported rather than swallowed, because "we checked and found nothing" and
   * "we could not check" are different facts and only one of them is
   * reassuring.
   */
  unavailable: boolean
}

/**
 * Asks the public stores whether a bundle identifier is already taken.
 *
 * ADVISORY. NEVER BLOCKING. Two reasons, and the second is the important one.
 *
 * First, coverage is uneven and cannot be made even. Apple publishes a lookup
 * endpoint that answers this properly. Google Play has no equivalent — the
 * Play Developer API only covers apps you already own, and the alternative is
 * scraping a store page, which breaks silently and is against their terms. A
 * check that works for iOS and quietly does nothing for Android, presented as
 * "we check for collisions", is worse than no check: it invites trust it
 * cannot repay.
 *
 * Second, a collision is not necessarily wrong. An internal store legitimately
 * hosts a company's own build of an app that also exists publicly — that is
 * the ordinary case for a company that ships to both. Blocking it would refuse
 * the correct thing.
 *
 * So this answers a question and says nothing about what to do with the answer.
 */
@Injectable()
export class PackageLookupService {
  private readonly logger = new Logger(PackageLookupService.name)

  async lookup(packageId: string): Promise<PackageLookup> {
    if (!packageId) return { match: null, unavailable: false }

    try {
      const url = `${ITUNES_LOOKUP}?bundleId=${encodeURIComponent(packageId)}&limit=1`
      const response = await fetch(url, {
        // Publishing must not wait on somebody else's uptime.
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!response.ok) return { match: null, unavailable: true }

      const body = (await response.json()) as {
        resultCount?: number
        results?: { trackName?: string; sellerName?: string; trackViewUrl?: string }[]
      }

      const first = body.results?.[0]
      if (!body.resultCount || !first) return { match: null, unavailable: false }

      return {
        match: {
          store: 'apple',
          name: first.trackName ?? packageId,
          seller: first.sellerName ?? 'Unknown',
          url: first.trackViewUrl ?? '',
        },
        unavailable: false,
      }
    } catch (error) {
      // Logged at debug: a failed advisory lookup is not an incident, and at
      // warn it would fill the log every time somebody types offline.
      this.logger.debug(`Bundle lookup failed for ${packageId}: ${String(error)}`)
      return { match: null, unavailable: true }
    }
  }
}
