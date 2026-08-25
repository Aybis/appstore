import { Controller, Get, Query, Req } from '@nestjs/common'

import { Roles } from '../auth/roles.decorator'
import { DashboardService, type Dashboard } from './dashboard.service'

interface AuthedRequest {
  auth?: { orgId: string }
}

/** Publisher and above: it is an operational view, not a personal one. */
@Controller('dashboard')
@Roles('publisher', 'admin', 'owner')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  load(@Req() req: AuthedRequest, @Query('days') days?: string): Promise<Dashboard> {
    const orgId = req.auth?.orgId
    if (!orgId) throw new Error('DashboardController reached without authentication')

    // Clamped rather than trusted: the window goes straight into an interval,
    // and an unbounded one is a table scan somebody can ask for repeatedly.
    const parsed = Number(days)
    const windowDays = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 365) : 30

    return this.dashboard.load(orgId, windowDays)
  }
}
