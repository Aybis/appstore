import { createReadStream, existsSync } from 'node:fs'
import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common'

import { Public } from '../auth/public.decorator'
import { IconStore } from '../storage/icon-store'

/**
 * App icons, served publicly and addressed by digest.
 *
 * `@Public()` because an `<img>` tag cannot send an Authorization header, and
 * the alternatives are worse: a token in the query string is a credential in
 * every access log and referrer, and inlining images as data URIs would bloat
 * every catalog response for the sake of a picture.
 *
 * What makes that acceptable is the addressing. The URL is a SHA-256 and
 * nothing else — no org, no slug, no app id — so it is unguessable and
 * discloses nothing even to somebody who has one. And what it protects is a
 * picture the company chose to represent an app, which reveals less than the
 * catalog listing it appears in.
 */
@Controller('icons')
export class IconController {
  constructor(private readonly icons: IconStore) {}

  @Public()
  @Get(':key')
  // Immutable is honest here in a way it rarely is: the digest IS the content,
  // so this URL can never serve different bytes.
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  icon(@Param('key') key: string): StreamableFile {
    const resolved = this.icons.resolve(key)
    if (!resolved) throw new NotFoundException('No such icon')
    if (!existsSync(resolved.absolutePath)) throw new NotFoundException('No such icon')

    return new StreamableFile(createReadStream(resolved.absolutePath), {
      type: resolved.contentType,
    })
  }
}
