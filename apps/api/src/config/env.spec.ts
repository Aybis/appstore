import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/appstore',
  JWT_SECRET: 'a'.repeat(32),
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'artifacts',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
}

describe('loadEnv', () => {
  it('parses a valid environment and coerces PORT to a number', () => {
    const env = loadEnv(validEnv)
    expect(env.PORT).toBe(3000)
    expect(env.DATABASE_URL).toBe(validEnv.DATABASE_URL)
  })

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/)
  })

  it('rejects a missing DATABASE_URL rather than defaulting', () => {
    const { DATABASE_URL: _omitted, ...withoutDb } = validEnv
    expect(() => loadEnv(withoutDb)).toThrow(/DATABASE_URL/)
  })

  it('names every invalid variable in the error message', () => {
    expect(() => loadEnv({ ...validEnv, JWT_SECRET: 'x', S3_BUCKET: '' })).toThrow(/S3_BUCKET/)
  })
})
