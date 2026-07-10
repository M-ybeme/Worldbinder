import { describe, expect, it } from 'vitest'
import { apiEnvSchema, loadEnv } from './env.js'

describe('loadEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv(apiEnvSchema, {
      DATABASE_URL: 'postgres://user:pass@localhost:5432/worldbinder',
      REDIS_URL: 'redis://localhost:6379',
    })

    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3000)
  })

  it('throws with a readable message when required variables are missing', () => {
    expect(() => loadEnv(apiEnvSchema, {})).toThrow(/DATABASE_URL/)
  })
})
