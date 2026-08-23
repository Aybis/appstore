import { Module } from '@nestjs/common'
import { DatabaseModule } from '../db/database.provider'
import { AuditController } from './audit.controller'
import { AuditService } from './audit.service'

/**
 * Exports AuditService so the modules that perform privileged actions —
 * publishing, issuing download tickets — can record them. Importing this
 * module is what makes an action auditable; there is no global provider,
 * deliberately, so the import list of a module says whether it writes history.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
