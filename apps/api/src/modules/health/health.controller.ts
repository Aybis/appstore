import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/public.decorator'

@Controller('health')
export class HealthController {
  // Round 1, M4: JwtGuard/RolesGuard are now global (APP_GUARD in
  // auth.module.ts), so every route requires authentication unless it opts
  // out explicitly. A load balancer's health probe carries no bearer token.
  @Public()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' }
  }
}
