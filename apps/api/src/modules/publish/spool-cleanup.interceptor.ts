import fs from 'node:fs/promises'
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { finalize } from 'rxjs/operators'

import { UploadSlots } from './upload-slots'

/** Only what this interceptor reads off the request. Structural, per convention. */
interface SpooledRequest {
  file?: { path?: string }
  auth?: { orgId: string }
}

/**
 * Deletes multer's spool file however the request ends.
 *
 * Closes security review S-7. Multer writes the upload to disk BEFORE the
 * handler runs, and only the success path consumed it: ArtifactStore.put()
 * renames the file into the store, and cleans up if it throws. Everything that
 * failed EARLIER than that left the bytes behind forever —
 *
 *   - body validation rejecting the request (the pipe runs after multer, so a
 *     missing `packageId` spools the whole APK and then 400s),
 *   - the extension check in the controller,
 *   - assertValidPackage refusing a file that is not the package it claims,
 *   - the client hanging up mid-request.
 *
 * Measured on a development machine before this existed: 99 orphaned files.
 * They were bytes each, because the test uploads were tiny. A rejected 100 MB
 * APK leaks 100 MB, and the rejection paths are the ones a misconfigured CI
 * job hits over and over.
 *
 * `finalize` rather than `catchError` on purpose: it runs on success, on
 * error, AND on unsubscribe, which is what covers a client that disconnects
 * mid-flight. On the success path the file has already been renamed away, so
 * the delete is a no-op — `force` makes that silent rather than an error.
 *
 * IT ALSO HOLDS THE CONCURRENCY SLOT, and that is why the two live together.
 * The slot has to be claimed BEFORE multer writes anything, or the cap cannot
 * prevent the disk filling — it would only report it afterwards. This
 * interceptor is declared ahead of FileInterceptor so its pre-handler half
 * runs first, and `finalize` releases the slot on exactly the same outcomes
 * that clean the file. Splitting acquire and release across two classes is how
 * a leak gets reintroduced by an edit that only looks at one of them.
 */
@Injectable()
export class SpoolCleanupInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SpoolCleanupInterceptor.name)

  constructor(private readonly slots: UploadSlots) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SpooledRequest>()

    // Guards run before interceptors, so the org is already resolved here.
    // Absent means the route is unauthenticated, which no upload route is —
    // falling back keeps this from throwing on a shape it did not expect.
    const orgId = request.auth?.orgId ?? 'unknown'

    // Throws 429 when the org is already at its limit. Before next.handle(),
    // so multer never runs and no bytes reach the disk.
    this.slots.acquire(orgId)

    return next.handle().pipe(
      finalize(() => {
        this.slots.release(orgId)

        const spooled = request.file?.path
        if (!spooled) return

        // Deliberately not awaited: the response is already on its way, and
        // making the client wait on an unlink would be the wrong trade.
        void fs.rm(spooled, { force: true }).catch((error: unknown) => {
          // Worth a line in the log — a spool that cannot be swept fills a disk
          // eventually, and silence is how that becomes a 3am problem.
          this.logger.warn(`Could not remove spool file ${spooled}: ${String(error)}`)
        })
      }),
    )
  }
}
