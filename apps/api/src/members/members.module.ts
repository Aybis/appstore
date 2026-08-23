import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { AuthModule } from '../auth/auth.module'
import { DatabaseModule } from '../db/database.provider'
import { MembersController } from './members.controller'
import { MembersService } from './members.service'

/** Membership administration — see MembersService for why "tester" is not a role. */
@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
