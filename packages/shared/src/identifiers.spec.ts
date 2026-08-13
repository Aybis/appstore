import { describe, expect, it } from 'vitest'
import { appSlugSchema, orgSlugSchema, semverSchema } from './identifiers.js'

describe('orgSlugSchema', () => {
  it('accepts lowercase alphanumeric slugs with internal hyphens', () => {
    expect(orgSlugSchema.parse('acme-corp')).toBe('acme-corp')
  })

  it('rejects uppercase', () => {
    expect(() => orgSlugSchema.parse('Acme')).toThrow()
  })

  it('rejects leading and trailing hyphens', () => {
    expect(() => orgSlugSchema.parse('-acme')).toThrow()
    expect(() => orgSlugSchema.parse('acme-')).toThrow()
  })

  it('rejects reserved slugs that would collide with API routes', () => {
    expect(() => orgSlugSchema.parse('api')).toThrow()
    expect(() => orgSlugSchema.parse('admin')).toThrow()
  })

  it('rejects slugs shorter than 3 or longer than 63 characters', () => {
    expect(() => orgSlugSchema.parse('ab')).toThrow()
    expect(() => orgSlugSchema.parse('a'.repeat(64))).toThrow()
  })
})

describe('semverSchema', () => {
  it('accepts a plain major.minor.patch', () => {
    expect(semverSchema.parse('1.2.3')).toBe('1.2.3')
  })

  it('accepts a prerelease suffix', () => {
    expect(semverSchema.parse('1.2.3-rc.1')).toBe('1.2.3-rc.1')
  })

  it('rejects a two-part version', () => {
    expect(() => semverSchema.parse('1.2')).toThrow()
  })
})

describe('appSlugSchema', () => {
  it('does not reserve route names, because app slugs are org-scoped', () => {
    expect(appSlugSchema.parse('api')).toBe('api')
  })
})
