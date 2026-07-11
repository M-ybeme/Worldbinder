import { describe, expect, it } from 'vitest'
import { apiEnvSchema, loadEnv } from './env.js'

describe('loadEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv(apiEnvSchema, {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/worldbinder',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
    })

    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900)
  })

  it('throws with a readable message when required variables are missing', () => {
    expect(() => loadEnv(apiEnvSchema, {})).toThrow(/DATABASE_URL/)
  })

  it('parses the literal string "false" as boolean false, not JS-truthy true', () => {
    const env = loadEnv(apiEnvSchema, {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/worldbinder',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      SMTP_SECURE: 'false',
    })

    expect(env.SMTP_SECURE).toBe(false)
  })

  it('parses the literal string "true" as boolean true', () => {
    const env = loadEnv(apiEnvSchema, {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/worldbinder',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      SMTP_SECURE: 'true',
    })

    expect(env.SMTP_SECURE).toBe(true)
  })
})
