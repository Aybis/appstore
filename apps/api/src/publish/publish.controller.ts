import os from 'node:os'
import path from 'node:path'
import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ZodValidationPipe } from 'nestjs-zod'
import {
  createAppSchema,
  createReleaseSchema,
  type CreateAppInput,
  type CreateReleaseInput,
} from '@appstore/shared'
import { Roles } from '../auth/roles.decorator'
import { PublishService, type PublishedApp, type PublishedRelease } from './publish.service'

/** Where multer parks an upload before it is moved into the store. */
const UPLOAD_TMP = process.env.UPLOAD_TMP ?? path.join(os.tmpdir(), 'maya-uploads')

/** 2 GiB — comfortably above a large IPA, low enough to bound disk use. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set(['.apk', '.ipa'])

/** Structural, matching this package's no-@types/express, no-@types/multer convention. */
interface UploadedArtifact {
  path: string
  originalname: string
  size: number
}

interface AuthedRequest {
  auth?: { sub: string; orgId: string }
}

/**
 * Publisher-side writes.
 *
 * `@Roles('publisher', 'admin', 'owner')` — a viewer can read the catalog but
 * must not be able to put a binary into it. RolesGuard re-reads the membership
 * row on every request, so a revoked publisher loses this immediately rather
 * than when their token expires.
 */
@Controller('apps')
export class PublishController {
  constructor(private readonly publish: PublishService) {}

  private identity(req: AuthedRequest): { orgId: string; userId: string } {
    const auth = req.auth
    if (!auth) throw new Error('PublishController reached without authentication')
    return { orgId: auth.orgId, userId: auth.sub }
  }

  @Post()
  @Roles('publisher', 'admin', 'owner')
  createApp(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createAppSchema)) body: CreateAppInput,
  ): Promise<PublishedApp> {
    const { orgId, userId } = this.identity(req)
    return this.publish.createApp(orgId, userId, body)
  }

  /**
   * Uploads a build. The binary is streamed to a temp file by multer rather
   * than buffered — a 200 MB APK in memory per concurrent upload is not a
   * thing a server survives.
   */
  @Post(':slug/releases')
  @Roles('publisher', 'admin', 'owner')
  @UseInterceptors(
    FileInterceptor('file', {
      dest: UPLOAD_TMP,
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  createRelease(
    @Req() req: AuthedRequest,
    @Param('slug') slug: string,
    @UploadedFile() file: UploadedArtifact | undefined,
    @Body(new ZodValidationPipe(createReleaseSchema)) body: CreateReleaseInput,
  ): Promise<PublishedRelease> {
    if (!file) throw new BadRequestException('a "file" part is required')

    const extension = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('file must be a .apk or .ipa')
    }

    const { orgId, userId } = this.identity(req)
    return this.publish.createRelease(orgId, userId, slug, body, {
      tempPath: file.path,
      originalName: file.originalname,
    })
  }

  @Post(':slug/releases/:releaseId/publish')
  @Roles('publisher', 'admin', 'owner')
  publishRelease(
    @Req() req: AuthedRequest,
    @Param('releaseId') releaseId: string,
  ): Promise<{ status: string }> {
    const { orgId } = this.identity(req)
    return this.publish.publishRelease(orgId, releaseId)
  }
}
