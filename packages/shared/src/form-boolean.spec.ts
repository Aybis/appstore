import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { formBooleanSchema } from './form-boolean.js'

const withDefault = formBooleanSchema.default(false)

describe('formBooleanSchema', () => {
  it.each(['true', 'TRUE', ' True ', '1', 'yes', 'on'])('reads %j as true', (input) => {
    expect(formBooleanSchema.parse(input)).toBe(true)
  })

  // The regression this schema exists for: z.coerce.boolean() returns true for
  // every one of these, because they are non-empty strings.
  it.each(['false', 'FALSE', ' false ', '0', 'no', 'off', ''])('reads %j as false', (input) => {
    expect(formBooleanSchema.parse(input)).toBe(false)
  })

  it('passes real booleans through for JSON callers', () => {
    expect(formBooleanSchema.parse(true)).toBe(true)
    expect(formBooleanSchema.parse(false)).toBe(false)
  })

  it('rejects a word it does not recognise rather than guessing', () => {
    expect(() => formBooleanSchema.parse('ture')).toThrow(z.ZodError)
    expect(() => formBooleanSchema.parse('maybe')).toThrow(z.ZodError)
  })

  it('applies its default only when the field is absent', () => {
    expect(withDefault.parse(undefined)).toBe(false)
    expect(withDefault.parse('true')).toBe(true)
  })
})
