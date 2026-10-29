import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { SpoolCleanupInterceptor } from '../publish/spool-cleanup.interceptor'
import { UploadSlots } from '../publish/upload-slots'
import { IconStore } from '../storage/icon-store'
import { AccountController, AvatarController } from './account.controller'
import { AccountService } from './account.service'

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AccountController, AvatarController],
  providers: [AccountService, IconStore, SpoolCleanupInterceptor, UploadSlots],
})
export class AccountModule {}
