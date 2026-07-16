import { describe, expect, it } from 'vitest'
import { apiEnvSchema, loadEnv, workerEnvSchema } from './env.js'

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

function baseEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    ...overrides,
  }
}

describe('apiEnvSchema CORS_ORIGIN', () => {
  it('parses a comma-separated list, trimming whitespace', () => {
    const result = loadEnv(
      apiEnvSchema,
      baseEnv({ CORS_ORIGIN: 'https://a.example.com, https://b.example.com' }),
    )
    expect(result.CORS_ORIGIN).toEqual(['https://a.example.com', 'https://b.example.com'])
  })

  it('defaults to an empty list when unset', () => {
    const result = loadEnv(apiEnvSchema, baseEnv())
    expect(result.CORS_ORIGIN).toEqual([])
  })
})

describe('apiEnvSchema local-dev-only value guard', () => {
  it('allows the .env.example JWT placeholder in development', () => {
    const result = loadEnv(
      apiEnvSchema,
      baseEnv({
        NODE_ENV: 'development',
        JWT_ACCESS_SECRET: 'replace-with-a-random-32-byte-hex-string',
      }),
    )
    expect(result.JWT_ACCESS_SECRET).toBe('replace-with-a-random-32-byte-hex-string')
  })

  it('rejects the .env.example JWT placeholder outside development', () => {
    expect(() =>
      loadEnv(
        apiEnvSchema,
        baseEnv({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'replace-with-a-random-32-byte-hex-string',
        }),
      ),
    ).toThrow(/JWT_ACCESS_SECRET/)
  })

  it('rejects the default MinIO storage credentials outside development', () => {
    expect(() => loadEnv(apiEnvSchema, baseEnv({ NODE_ENV: 'production' }))).toThrow(
      /STORAGE_ACCESS_KEY_ID|STORAGE_SECRET_ACCESS_KEY/,
    )
  })

  it('allows a real secret and real storage credentials in production', () => {
    const result = loadEnv(
      apiEnvSchema,
      baseEnv({
        NODE_ENV: 'production',
        STORAGE_ACCESS_KEY_ID: 'a-real-r2-access-key',
        STORAGE_SECRET_ACCESS_KEY: 'a-real-r2-secret-key',
      }),
    )
    expect(result.NODE_ENV).toBe('production')
  })

  it('allows the dev defaults in test, alongside development', () => {
    // CI's integration-tests job (.github/workflows/ci.yml) runs with
    // NODE_ENV=test against ephemeral service containers using these same
    // dev-shaped storage credentials, and deliberately only overrides
    // JWT_ACCESS_SECRET — `test` is ephemeral/local-infra, not a real
    // deploy target, so it's exempt alongside `development`.
    const result = loadEnv(apiEnvSchema, baseEnv({ NODE_ENV: 'test' }))
    expect(result.NODE_ENV).toBe('test')
  })
})

function baseWorkerEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    ...overrides,
  }
}

describe('workerEnvSchema local-dev-only value guard', () => {
  // apps/worker talks directly to the same storage bucket as apps/api (see
  // apps/worker/src/storage/s3-client.ts) — a production worker deploy that
  // forgot to set real storage credentials is exactly as real a footgun as
  // the API being, so it needs the same guard apiEnvSchema already had.
  it('allows the default MinIO storage credentials in development', () => {
    const result = loadEnv(workerEnvSchema, baseWorkerEnv({ NODE_ENV: 'development' }))
    expect(result.STORAGE_ACCESS_KEY_ID).toBe('worldbinder')
  })

  it('allows the default MinIO storage credentials in test', () => {
    const result = loadEnv(workerEnvSchema, baseWorkerEnv({ NODE_ENV: 'test' }))
    expect(result.STORAGE_ACCESS_KEY_ID).toBe('worldbinder')
  })

  it('rejects the default MinIO storage credentials outside development/test', () => {
    expect(() => loadEnv(workerEnvSchema, baseWorkerEnv({ NODE_ENV: 'production' }))).toThrow(
      /STORAGE_ACCESS_KEY_ID|STORAGE_SECRET_ACCESS_KEY/,
    )
  })

  it('allows real storage credentials in production', () => {
    const result = loadEnv(
      workerEnvSchema,
      baseWorkerEnv({
        NODE_ENV: 'production',
        STORAGE_ACCESS_KEY_ID: 'a-real-r2-access-key',
        STORAGE_SECRET_ACCESS_KEY: 'a-real-r2-secret-key',
      }),
    )
    expect(result.NODE_ENV).toBe('production')
  })
})
