import os from 'node:os'
import path from 'node:path'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type Profile,
  type UpdateProfileInput,
} from '@appstore/shared'
import { ZodValidationPipe } from 'nestjs-zod'

import { Public } from '../auth/public.decorator'
import { SpoolCleanupInterceptor } from '../publish/spool-cleanup.interceptor'
import { IconStore } from '../storage/icon-store'
import { AccountService, type Caller } from './account.service'

interface AuthedRequest {
  auth?: { sub: string; orgId: string; role: string; kind?: 'api_key' }
}

const UPLOAD_TMP = process.env.UPLOAD_TMP ?? path.join(os.tmpdir(), 'maya-uploads')
const MAX_AVATAR_BYTES = 1024 * 1024

/** Your own account. Any signed-in person may use it; an API key may not. */
@Controller('me')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly images: IconStore,
  ) {}

  private caller(req: AuthedRequest): Caller {
    const auth = req.auth
    // A build server's key has no person behind it, so it has no profile.
    if (!auth || auth.kind === 'api_key') throw new BadRequestException('Sign in as a person to use this')
    return { userId: auth.sub, orgId: auth.orgId, role: auth.role }
  }

  @Get()
  profile(@Req() req: AuthedRequest): Promise<Profile> {
    return this.account.profile(this.caller(req))
  }

  @Patch()
  update(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<Profile> {
    return this.account.update(this.caller(req), body)
  }

  /** Multipart, field `avatar`: a PNG, JPEG or WebP of at most 1 MB. */
  @Post('avatar')
  @UseInterceptors(
    SpoolCleanupInterceptor,
    FileInterceptor('avatar', { dest: UPLOAD_TMP, limits: { fileSize: MAX_AVATAR_BYTES } }),
  )
  async setAvatar(
    @Req() req: AuthedRequest,
    @UploadedFile() file: { path: string } | undefined,
  ): Promise<Profile> {
    const caller = this.caller(req)
    if (!file) throw new BadRequestException('Attach an image as "avatar"')
    const stored = await this.images.put(file.path, 'avatars')
    return this.account.setAvatar(caller, stored.key)
  }

  @Delete('avatar')
  removeAvatar(@Req() req: AuthedRequest): Promise<Profile> {
    return this.account.setAvatar(this.caller(req), '')
  }

  @Post('password')
  @HttpCode(204)
  async changePassword(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ): Promise<void> {
    await this.account.changePassword(this.caller(req), body)
  }
}

/**
 * Profile pictures, public like app icons: an <img> cannot send a token, and
 * the digest name reveals no person.
 */
@Controller('avatars')
export class AvatarController {
  constructor(private readonly images: IconStore) {}

  @Public()
  @Get(':key')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async avatar(@Param('key') key: string): Promise<StreamableFile> {
    const image = await this.images.open(key, 'avatars')
    if (!image) throw new NotFoundException('No such avatar')
    return new StreamableFile(image.body, { type: image.contentType, length: image.sizeBytes })
  }
}
