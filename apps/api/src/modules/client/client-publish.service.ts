import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { AuditService } from '../audit/audit.service'
import { DATABASE, type Database } from '../../database/database.provider'
import { withTenant } from '../../database/tenant'
import { blobStore } from '../storage/blob-store'
import { androidLabel, ApkReadError, readApkInfo } from './apk-info'
import type { ClientBuild, ManifestEntry } from './client.service'

type ReleaseArtifact = {
  version: string
  platform: string
  status: string
  package_id: string
  storage_key: string
  sha256: string
}

type Manifest = Record<string, ManifestEntry | null | undefined>

/**
 * Turns a release somebody already uploaded into the public MAYA client build.
 *
 * ClientService calls the client a deploy artifact, and that still holds: this
 * is the deploy step done from the console, by the same roles that can
 * already mint API keys. It reads the facts out of the APK and writes
 * `client/manifest.json`, pointing at the release's file — the bytes are never
 * copied. The facts come from the file, never from the person clicking.
 *
 * Everything that would put a wrong or unusable build on the public page is
 * refused rather than corrected:
 *   - the bytes are re-hashed and must match what the catalog recorded;
 *   - the APK's own package name must match the release's;
 *   - the versionCode may not go down, because Android refuses to install a
 *     lower one over a higher one and the page would offer a download that
 *     fails on every phone that already has MAYA.
 */
@Injectable()
export class ClientPublishService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  async publishFromRelease(orgId: string, userId: string, releaseId: string): Promise<ClientBuild> {
    const release = await withTenant(this.db, orgId, async (tx) => {
      const rows = await tx.execute<ReleaseArtifact>(sql`
        SELECT r.version, r.platform, r.status, a.package_id, a.storage_key, a.sha256
        FROM releases r
        JOIN artifacts a ON a.release_id = r.id
        WHERE r.id = ${releaseId}::uuid
        LIMIT 1`)
      return [...rows][0]
    })

    if (!release) throw new NotFoundException('Release not found')
    if (release.platform !== 'android') {
      throw new BadRequestException('Only Android builds can be published as the MAYA client')
    }
    if (release.status !== 'published') {
      throw new BadRequestException('Only a published release can become the MAYA client')
    }

    const staged = path.join(os.tmpdir(), `maya-client-${randomUUID()}.apk`)
    try {
      const sha256 = await this.stage(release.storage_key, staged)
      if (sha256 !== release.sha256) {
        // The catalog and the store disagree about these bytes. Publishing
        // either one publicly would be a guess.
        throw new ConflictException('The stored file does not match its recorded digest')
      }

      const info = await readApkInfo(staged).catch((error: unknown) => {
        if (error instanceof ApkReadError) throw new BadRequestException(error.message)
        throw error
      })
      if (info.packageId !== release.package_id) {
        throw new BadRequestException(
          `The APK says it is ${info.packageId}, but the release is recorded as ${release.package_id}`,
        )
      }

      const manifest = await this.readManifest()
      const current = manifest.android
      if (current && current.sha256 !== sha256 && info.versionCode <= current.versionCode) {
        throw new ConflictException(
          `The live client is build ${current.versionCode}. A new one needs a higher versionCode, ` +
            `and this APK is build ${info.versionCode}.`,
        )
      }

      const { size } = await fs.stat(staged)

      // Points at the release's own file. No copy: the build stays stored
      // once, where the catalog keeps it, and artifacts.storage_key is the
      // link between this manifest and the database.
      const entry: ManifestEntry = {
        version: info.versionName,
        versionCode: info.versionCode,
        storageKey: release.storage_key,
        sha256,
        sizeBytes: size,
        packageId: info.packageId,
        minSdk: info.minSdk,
        minOsLabel: androidLabel(info.minSdk),
        abis: info.abis,
        signerSha256: info.signerSha256,
        releasedAt: new Date().toISOString(),
        source: `console:${releaseId}`,
      }
      await blobStore().putBuffer(
        'client/manifest.json',
        Buffer.from(`${JSON.stringify({ ...manifest, android: entry }, null, 2)}\n`),
        'application/json',
      )

      await this.audit.record(orgId, {
        actorId: userId,
        action: 'client.published',
        subjectType: 'client',
        subjectId: 'android',
        metadata: {
          releaseId,
          version: info.versionName,
          versionCode: info.versionCode,
          sha256,
          replaced: current ? `${current.version} (${current.versionCode})` : null,
        },
      })

      return {
        platform: 'android',
        version: entry.version,
        versionCode: entry.versionCode,
        sizeBytes: entry.sizeBytes,
        sha256: entry.sha256,
        packageId: entry.packageId,
        minOsLabel: entry.minOsLabel,
        abis: entry.abis,
        releasedAt: entry.releasedAt,
      }
    } finally {
      await fs.rm(staged, { force: true }).catch(() => undefined)
    }
  }

  /** Copies the stored object to a temp file and returns its SHA-256. */
  private async stage(storageKey: string, destination: string): Promise<string> {
    const object = await blobStore().get(storageKey)
    if (!object) throw new NotFoundException('The release file is missing from the store')
    const hash = createHash('sha256')
    await pipeline(
      object.body,
      async function* (source) {
        for await (const chunk of source) {
          hash.update(chunk as Buffer)
          yield chunk
        }
      },
      createWriteStream(destination),
    )
    return hash.digest('hex')
  }

  private async readManifest(): Promise<Manifest> {
    const object = await blobStore().get('client/manifest.json')
    if (!object) return {}
    const chunks: Buffer[] = []
    for await (const chunk of object.body) chunks.push(chunk as Buffer)
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Manifest
    } catch {
      // Refuse to overwrite a manifest we cannot read: the entries in it (ios,
      // or fields this code does not know) would be lost silently.
      throw new ConflictException('The existing client manifest is unreadable; fix it before publishing')
    }
  }
}
