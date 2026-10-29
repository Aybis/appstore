import { HttpException, HttpStatus, Injectable } from '@nestjs/common'

/**
 * How many uploads one organization may have in flight at once.
 *
 * Three, not one: a publisher pushing an Android and an iOS build together is
 * ordinary, and CI pipelines legitimately run a couple of jobs side by side.
 * Three at the 2 GiB ceiling bounds one org to 6 GiB of spool.
 */
const MAX_CONCURRENT_PER_ORG = 3

/**
 * A bound on concurrent uploads, which the per-file limit does not give.
 *
 * `limits.fileSize` caps ONE upload at 2 GiB and says nothing about fifty of
 * them arriving together. The spool is written before anything validates it,
 * so an authenticated publisher — or a CI job stuck in a retry loop, which is
 * the likelier cause — can fill the disk with files the server has not yet
 * agreed to keep.
 *
 * IN-MEMORY, AND THEREFORE PER-PROCESS. Behind several API instances this caps
 * each instance rather than the org as a whole. That is stated rather than
 * hidden: it still turns an unbounded number into a small multiple of a bounded
 * one, and the alternative — a shared counter in Redis — buys precision this
 * does not need yet and adds a dependency that can fail open.
 */
@Injectable()
export class UploadSlots {
  private readonly inFlight = new Map<string, number>()

  /**
   * Claims a slot, or refuses. The caller MUST release in a `finally`.
   *
   * Returns nothing and throws on refusal rather than returning a boolean,
   * because a boolean invites being ignored at one call site and that call
   * site is the one that fills the disk.
   */
  acquire(orgId: string): void {
    const current = this.inFlight.get(orgId) ?? 0
    if (current >= MAX_CONCURRENT_PER_ORG) {
      throw new HttpException(
        `Too many uploads in progress. Wait for one to finish and retry.`,
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    this.inFlight.set(orgId, current + 1)
  }

  release(orgId: string): void {
    const current = this.inFlight.get(orgId) ?? 0
    // Delete at zero rather than leaving a 0 behind: this map is keyed by org
    // and would otherwise grow forever on a multi-tenant deployment.
    if (current <= 1) this.inFlight.delete(orgId)
    else this.inFlight.set(orgId, current - 1)
  }

  /** For tests and diagnostics. */
  countFor(orgId: string): number {
    return this.inFlight.get(orgId) ?? 0
  }
}
