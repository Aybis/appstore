import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { OrgsController } from './orgs.controller'
import { SignupService } from './signup.service'

@Module({
  imports: [AuthModule],
  controllers: [OrgsController],
  providers: [SignupService],
})
export class OrgsModule {}
