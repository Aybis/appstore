import { z } from 'zod'
import { orgSlugSchema } from '../identifiers.js'

/**
 * Long enough to resist guessing, short enough to type on a phone. Length
 * matters more than symbols, so the rule is 8+ with at least one letter and one
 * digit rather than a wall of character classes people work around with "!1".
 */
export const PASSWORD_MIN_LENGTH = 8

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(256)
  .regex(/[A-Za-z]/, 'password must contain a letter')
  .regex(/[0-9]/, 'password must contain a number')

export const signupSchema = z.object({
  orgSlug: orgSlugSchema,
  orgName: z.string().min(1).max(120),
  email: z.string().email(),
  password: passwordSchema,
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
  password: passwordSchema,
  displayName: z.string().min(1).max(120),
})

export type RegisterInput = z.infer<typeof registerSchema>
