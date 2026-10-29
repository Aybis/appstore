import { Controller, Get } from '@nestjs/common'

import { Public } from '../auth/public.decorator'
import { StatsService, type PublicStats } from './stats.service'

/**
 * Public, unlike the dashboard: the landing page shows these to visitors who
 * have not signed in. Safe because it is four totals for the whole
 * deployment, cached — see StatsService.
 */
@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Public()
  @Get()
  load(): Promise<PublicStats> {
    return this.stats.load()
  }
}
