import { createReadStream } from 'node:fs'
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common'
import { toString as qrToString } from 'qrcode'
import { loadEnv } from '../config/env'
import { Public } from '../auth/public.decorator'
import {
  ClientService,
  isClientPlatform,
  resolvePortalUrl,
  type ClientBuild,
} from './client.service'

/** Only the response surface this handler uses — see catalog/download.controller.ts. */
interface StreamResponse {
  set(headers: Record<string, string>): unknown
}

/**
 * How MAYA gets onto a device that does not have MAYA.
 *
 * PUBLIC WITHOUT A SIGNED URL, unlike every other download in this API, and
 * that is a deliberate call rather than an oversight.
 *
 * The catalog's downloads are signed because they are somebody's private
 * software. This binary is the sign-in screen: it holds no tenant data, no
 * catalog, and no credentials, and it cannot show a single app until a real
 * account authenticates against a real org. Gating it would buy nothing except
 * a bootstrap loop — you would need a session on the phone to install the app
 * that gets you a session on the phone — and would push people toward the one
 * outcome worth avoiding, which is passing APKs around over chat.
 *
 * What the binary does reveal is that this company runs MAYA. That is the
 * whole exposure, and it is worth an install path that works from a QR code on
 * a wiki page.
 */
@Controller('client')
export class ClientController {
  constructor(private readonly client: ClientService) {}

  /** Read once per instance, matching download-signer.ts. */
  private readonly env = loadEnv(process.env)

  /** Metadata for the portal: version, size, fingerprint, requirements. */
  @Public()
  @Get()
  async builds(): Promise<{ builds: ClientBuild[]; portalUrl: string | null }> {
    return {
      builds: await this.client.available(),
      portalUrl: resolvePortalUrl(this.env.PORTAL_URL, this.env.CORS_ORIGINS),
    }
  }

  /**
   * The install QR, rendered server-side as SVG.
   *
   * An <img> tag costs the page nothing; a client-side encoder would add a
   * library to every visitor's download for one small graphic. It also means
   * the code encodes a URL the SERVER resolved, so nobody can hand out a
   * MAYA-branded QR pointing somewhere else by passing their own target in a
   * query string.
   */
  @Public()
  @Get('qr.svg')
  async qr(@Res({ passthrough: true }) res: StreamResponse): Promise<string> {
    const portal = resolvePortalUrl(this.env.PORTAL_URL, this.env.CORS_ORIGINS)
    if (!portal) {
      throw new ServiceUnavailableException(
        'No reachable portal URL is configured — set PORTAL_URL',
      )
    }

    res.set({ 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' })

    // Level M correction: enough redundancy to survive a phone camera at an
    // angle, without inflating the module count so far that it stops scanning
    // from across a desk.
    return qrToString(portal, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#17121f', light: '#ffffff' },
    })
  }

  @Public()
  @Get(':platform/download')
  async download(
    @Param('platform') platform: string,
    @Res({ passthrough: true }) res: StreamResponse,
  ): Promise<StreamableFile> {
    // Allowlist BEFORE anything touches the filesystem: the platform is the
    // only user-controlled value on this route, so it never becomes a path
    // segment until it has been proven to be one of two known strings.
    if (!isClientPlatform(platform)) throw new NotFoundException('Unknown platform')

    const file = await this.client.resolve(platform)

    res.set({
      'Content-Type': file.contentType,
      'Content-Length': String(file.sizeBytes),
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      // The URL is stable across releases while the bytes behind it are not,
      // so a cached copy would hand out last month's client forever.
      'Cache-Control': 'no-store',
    })
    return new StreamableFile(createReadStream(file.absolutePath))
  }
}
