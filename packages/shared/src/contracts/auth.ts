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

/**
 * Joining an organization that already exists. Unlike `signupSchema` there is
 * no org name: the slug must resolve, and the caller becomes an employee.
 */
export const registerSchema = z.object({
  orgSlug: orgSlugSchema,
  email: z.string().email(),
  password: z.string().min(12, 'password must be at least 12 characters').max(256),
  displayName: z.string().min(1).max(120),
})

export type RegisterInput = z.infer<typeof registerSchema>
