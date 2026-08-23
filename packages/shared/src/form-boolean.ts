import { z } from 'zod'

/**
 * A boolean arriving as a multipart or urlencoded form field.
 *
 * `z.coerce.boolean()` is WRONG for this and silently so: it is
 * `Boolean(value)`, and every non-empty string is truthy, so the string
 * `"false"` parses to `true` — as do `"0"` and `"no"`. A form has no way to
 * send a real boolean; it sends the word. Using the coercing schema on
 * `publish` meant a publisher who explicitly asked for a draft got an
 * immediately-published, immutable release live on every device in their org.
 *
 * Real booleans pass through so JSON callers are unaffected. Anything that is
 * neither a boolean nor a recognised spelling is REJECTED rather than guessed
 * at — a typo'd `"ture"` must not decide whether a build ships.
 */
const TRUE_WORDS = new Set(['true', '1', 'yes', 'on'])
const FALSE_WORDS = new Set(['false', '0', 'no', 'off', ''])

export const formBooleanSchema = z
  .union([z.boolean(), z.string()])
  .transform((value, ctx) => {
    if (typeof value === 'boolean') return value

    const normalized = value.trim().toLowerCase()
    if (TRUE_WORDS.has(normalized)) return true
    if (FALSE_WORDS.has(normalized)) return false

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `must be a boolean, received "${value}"`,
    })
    return z.NEVER
  })
