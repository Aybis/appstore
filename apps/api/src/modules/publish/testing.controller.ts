import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import { ZodValidationPipe } from 'nestjs-zod'
import { z } from 'zod'

import { Roles } from '../auth/roles.decorator'
import type { ReleaseTrack } from '../catalog/catalog.service'
import { TestersService, type Tester, type TestingApp } from './testers.service'

/** Structural, matching the convention in the other controllers. */
interface AuthedRequest {
  auth?: { sub: string; orgId: string }
}

const enrolManySchema = z.object({
  email: z.string().email(),
  slugs: z.array(z.string().min(1)).min(1, 'Pick at least one app'),
  /* `internal` is allowed but not the default: a tester who needs to see
     Development builds is the exception, and defaults should describe the
     ordinary case. */
  track: z.enum(['internal', 'beta']).default('beta'),
})

/**
 * Beta testing across the whole organization.
 *
 * The per-app routes under /apps/:slug/testers answer "who tests this app?".
 * They cannot answer "what is this person testing?" or "which builds are
 * waiting on Staging with nobody enrolled to try them?", because neither
 * question is scoped to one app — and those are the questions somebody running
 * a test cycle actually has.
 *
 * Publisher and above: enrolling a tester grants early sight of unreleased
 * software, which is the same authority publishing it requires.
 */
@Controller('testing')
@Roles('publisher', 'admin', 'owner')
export class TestingController {
  constructor(private readonly testers: TestersService) {}

  private identity(req: AuthedRequest): { orgId: string; userId: string } {
    const auth = req.auth
    if (!auth) throw new Error('TestingController reached without authentication')
    return { orgId: auth.orgId, userId: auth.sub }
  }

  @Get()
  overview(@Req() req: AuthedRequest): Promise<TestingApp[]> {
    return this.testers.overview(this.identity(req).orgId)
  }

  @Post('enrolments')
  enrolMany(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(enrolManySchema))
    body: { email: string; slugs: string[]; track: ReleaseTrack },
  ): Promise<{ enrolled: Tester[]; failed: { slug: string; reason: string }[] }> {
    const { orgId, userId } = this.identity(req)
    return this.testers.enrolMany(orgId, userId, body.slugs, body.email, body.track)
  }
}
