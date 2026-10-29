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

/** Editing your own profile. Email is the login, so it is not editable here. */
export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'name is required').max(120),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

/**
 * Changing your own password. The current one is required even with a valid
 * session: a phone left unlocked should not be enough to lock its owner out.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'enter your current password'),
    newPassword: passwordSchema,
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    message: 'the new password must be different',
    path: ['newPassword'],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

/** What GET /v1/me returns. `avatarUrl` is a path on the API, or '' for none. */
export interface Profile {
  id: string
  email: string
  displayName: string
  avatarUrl: string
  role: string
  createdAt: string
}
