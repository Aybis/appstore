import { z } from 'zod'
import { orgSlugSchema } from '../identifiers.js'

export const signupSchema = z.object({
  orgSlug: orgSlugSchema,
  orgName: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(12, 'password must be at least 12 characters').max(256),
  displayName: z.string().min(1).max(120),
})

export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  orgSlug: orgSlugSchema,
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>
