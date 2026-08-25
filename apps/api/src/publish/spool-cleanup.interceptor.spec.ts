import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { lastValueFrom, of, throwError } from 'rxjs'
import type { CallHandler, ExecutionContext } from '@nestjs/common'

import { SpoolCleanupInterceptor } from './spool-cleanup.interceptor'
import { UploadSlots } from './upload-slots'

/**
 * The paths that leaked before this existed were all the EARLY ones: body
 * validation, the extension check, package validation. ArtifactStore.put()
 * already consumed the file on the success path and cleaned up if it threw, so
 * only failures before it left bytes behind — 99 of them on a development
 * machine.
 */
describe('SpoolCleanupInterceptor', () => {
  let dir: string
  let spooled: string
  let slots: UploadSlots
  let interceptor: SpoolCleanupInterceptor

  const contextFor = (file?: { path: string }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ file, auth: { orgId: 'org-a' } }),
      }),
    }) as unknown as ExecutionContext

  const settled = async (): Promise<void> => {
    // The unlink is deliberately not awaited inside finalize — the response is
    // already on its way — so tests yield a turn before asserting.
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'maya-spool-'))
    spooled = path.join(dir, 'upload.bin')
    await fs.writeFile(spooled, 'pretend this is a 100 MB APK')
    slots = new UploadSlots()
    interceptor = new SpoolCleanupInterceptor(slots)
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  const exists = async (file: string): Promise<boolean> =>
    fs.stat(file).then(() => true).catch(() => false)

  it('removes the spool file when the handler SUCCEEDS', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) }
    await lastValueFrom(interceptor.intercept(contextFor({ path: spooled }), next))
    await settled()
    expect(await exists(spooled)).toBe(false)
  })

  it('removes it when the handler THROWS — the case that leaked', async () => {
    const next: CallHandler = { handle: () => throwError(() => new Error('bad package')) }
    await expect(
      lastValueFrom(interceptor.intercept(contextFor({ path: spooled }), next)),
    ).rejects.toThrow('bad package')
    await settled()
    expect(await exists(spooled)).toBe(false)
  })

  it('releases the concurrency slot on success', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) }
    await lastValueFrom(interceptor.intercept(contextFor({ path: spooled }), next))
    expect(slots.countFor('org-a')).toBe(0)
  })

  it('releases the slot even when the handler throws', async () => {
    // Otherwise three failed uploads would permanently wedge the org at its cap.
    const next: CallHandler = { handle: () => throwError(() => new Error('nope')) }
    await expect(
      lastValueFrom(interceptor.intercept(contextFor({ path: spooled }), next)),
    ).rejects.toThrow()
    expect(slots.countFor('org-a')).toBe(0)
  })

  it('claims the slot BEFORE the handler runs', async () => {
    let duringHandler = -1
    const next: CallHandler = {
      handle: () => {
        duringHandler = slots.countFor('org-a')
        return of({ ok: true })
      },
    }
    await lastValueFrom(interceptor.intercept(contextFor({ path: spooled }), next))
    // Multer writes inside next.handle(), so the slot must already be held.
    expect(duringHandler).toBe(1)
  })

  it('refuses once the org is at its cap, without running the handler', () => {
    let ran = false
    const next: CallHandler = {
      handle: () => {
        ran = true
        return of({ ok: true })
      },
    }
    for (let i = 0; i < 3; i += 1) slots.acquire('org-a')

    expect(() => interceptor.intercept(contextFor({ path: spooled }), next)).toThrow()
    expect(ran).toBe(false)
  })

  it('does nothing when there was no upload', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) }
    await expect(
      lastValueFrom(interceptor.intercept(contextFor(undefined), next)),
    ).resolves.toBeDefined()
  })
})
