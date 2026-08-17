import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common'
import { Public } from '../auth/public.decorator'
import { CatalogService } from './catalog.service'
import { DownloadSigner } from './download-signer'

import { storeRoot } from '../storage/artifact-store'

/** Only the response surface this handler actually uses — see catalog.controller.ts. */
interface StreamResponse {
  set(headers: Record<string, string>): unknown
}

/** Structural, matching the no-@types/express convention in this package. */
interface ManifestRequest {
  protocol: string
  get(header: string): string | undefined
}

/**
 * Streams an artifact to the platform's own downloader.
 *
 * `@Public()` opts out of the bearer-token guards for a specific reason, not
 * convenience: Android's DownloadManager fetches this URL in its own process
 * and does not replay our Authorization header. The capability lives in the
 * signed query string instead — see DownloadSigner — and the signature binds
 * the artifact to one org with a short expiry.
 */
@Controller('download')
export class DownloadController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly signer: DownloadSigner,
  ) {}

  /**
   * iOS fetches this itself after Safari opens the itms-services link, so it
   * carries the same signed capability as the stream rather than a token.
   */
  @Public()
  @Get(':artifactId/manifest.plist')
  async manifest(
    @Param('artifactId') artifactId: string,
    @Query('org') orgId: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Req() req: ManifestRequest,
    @Res({ passthrough: true }) res: StreamResponse,
  ): Promise<string> {
    if (!orgId || !exp || !sig) throw new ForbiddenException('Unsigned manifest URL')
    if (!this.signer.verify(artifactId, orgId, Number(exp), sig)) {
      throw new ForbiddenException('Manifest link is invalid or has expired')
    }

    // PUBLIC_BASE_URL matters here: iOS requires HTTPS for both the manifest
    // and the IPA it names, and the request origin is whatever the device dialled.
    const base =
      process.env.PUBLIC_BASE_URL ??
      `${req.protocol}://${req.get('host') ?? 'localhost'}`

    res.set({ 'Content-Type': 'application/xml; charset=utf-8' })
    return this.catalog.manifestFor(orgId, artifactId, base)
  }

  @Public()
  @Get(':artifactId/stream')
  async stream(
    @Param('artifactId') artifactId: string,
    @Query('org') orgId: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res({ passthrough: true }) res: StreamResponse,
  ): Promise<StreamableFile> {
    if (!orgId || !exp || !sig) throw new ForbiddenException('Unsigned download URL')
    if (!this.signer.verify(artifactId, orgId, Number(exp), sig)) {
      throw new ForbiddenException('Download link is invalid or has expired')
    }

    const artifact = await this.catalog.artifactForStream(orgId, artifactId)
    const root = storeRoot()
    const absolute = path.join(root, artifact.storageKey)

    // The key is derived from the digest, never from user input, but resolve
    // and re-check anyway so a malformed row cannot escape the store root.
    if (!path.resolve(absolute).startsWith(path.resolve(root))) {
      throw new ForbiddenException('Invalid storage key')
    }
    if (!existsSync(absolute)) throw new NotFoundException('Artifact is missing from the store')

    res.set({
      'Content-Type': artifact.contentType,
      'Content-Length': String(artifact.sizeBytes),
      'Content-Disposition': `attachment; filename="${artifact.filename}"`,
    })
    return new StreamableFile(createReadStream(absolute))
  }
}
