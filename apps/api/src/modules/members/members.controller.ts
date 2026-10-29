import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req } from '@nestjs/common'
import { z } from 'zod'

import { Roles } from '../auth/roles.decorator'
import { ZodValidationPipe } from 'nestjs-zod'
import {
  MembersService,
  type AppAccessMode,
  type Member,
  type MemberRole,
  type MemberStatus,
} from './members.service'

/** Structural, matching the convention in catalog/publish controllers. */
interface AuthedRequest {
  auth?: { sub: string; orgId: string; role: MemberRole }
}

const ROLES = ['owner', 'admin', 'publisher', 'viewer'] as const

const setRoleSchema = z.object({ role: z.enum(ROLES) })
const setStatusSchema = z.object({ status: z.enum(['active', 'disabled']) })
const setAppAccessSchema = z.object({
  mode: z.enum(['all', 'selected']),
  apps: z.array(z.string().min(1)).max(500).default([]),
})
const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(ROLES).default('viewer'),
})

/**
 * Who is in this organization, and what they may do.
 *
 * `@Roles('admin', 'owner')` throughout, and publisher is deliberately NOT on
 * that list: publishing software and deciding who works here are different
 * kinds of authority, and the person who uploads builds has no reason to be
 * able to grant themselves an owner role.
 */
@Controller('members')
@Roles('admin', 'owner')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  private identity(req: AuthedRequest): { orgId: string; userId: string } {
    const auth = req.auth
    if (!auth) throw new Error('MembersController reached without authentication')
    return { orgId: auth.orgId, userId: auth.sub }
  }

  @Get()
  list(@Req() req: AuthedRequest): Promise<Member[]> {
    return this.members.list(this.identity(req).orgId)
  }

  @Post()
  add(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(addMemberSchema)) body: { email: string; role: MemberRole },
  ): Promise<Member> {
    const { orgId, userId } = this.identity(req)
    return this.members.add(orgId, userId, body.email, body.role)
  }

  @Patch(':userId')
  setRole(
    @Req() req: AuthedRequest,
    @Param('userId') target: string,
    @Body(new ZodValidationPipe(setRoleSchema)) body: { role: MemberRole },
  ): Promise<Member> {
    const { orgId, userId } = this.identity(req)
    return this.members.setRole(orgId, userId, target, body.role)
  }

  @Patch(':userId/status')
  setStatus(
    @Req() req: AuthedRequest,
    @Param('userId') target: string,
    @Body(new ZodValidationPipe(setStatusSchema)) body: { status: MemberStatus },
  ): Promise<Member> {
    const { orgId, userId } = this.identity(req)
    return this.members.setStatus(orgId, userId, target, body.status)
  }

  @Put(':userId/apps')
  setAppAccess(
    @Req() req: AuthedRequest,
    @Param('userId') target: string,
    @Body(new ZodValidationPipe(setAppAccessSchema))
    body: { mode: AppAccessMode; apps: string[] },
  ): Promise<Member> {
    const { orgId, userId } = this.identity(req)
    return this.members.setAppAccess(orgId, userId, target, body.mode, body.apps)
  }

  @Delete(':userId')
  async remove(@Req() req: AuthedRequest, @Param('userId') target: string): Promise<void> {
    const { orgId, userId } = this.identity(req)
    await this.members.remove(orgId, userId, target)
  }
}
