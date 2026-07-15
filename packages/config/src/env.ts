import { z } from 'zod'

/**
 * `z.coerce.boolean()` uses JS's `Boolean(str)` semantics, so the string
 * "false" (non-empty) coerces to `true` — a classic footgun for env vars.
 * This parses the literal strings instead.
 */
function booleanString(defaultValue: 'true' | 'false') {
  return z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true')
}

export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv = process.env,
): z.infer<T> {
  const result = schema.safeParse(source)

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }

  return result.data
}

// Known local-dev-only values — never valid outside `NODE_ENV=development`.
// Each has a legitimate reason to default to these locally (so `pnpm dev`
// works out of the box against docker-compose/`.env.example` with zero
// ceremony) but booting a non-dev environment with any of them means a
// deploy silently skipped generating real credentials rather than failing
// closed. Checked in `apiEnvSchema`'s `superRefine` below, not per-field,
// since the check depends on `NODE_ENV`.
const KNOWN_DEV_ONLY_VALUES = {
  JWT_ACCESS_SECRET: 'replace-with-a-random-32-byte-hex-string',
  STORAGE_ACCESS_KEY_ID: 'worldbinder',
  STORAGE_SECRET_ACCESS_KEY: 'worldbinder-dev-secret',
} as const

/** Comma-separated allow-list, e.g. `https://app.example.com,https://staging.example.com`. */
function corsOriginList() {
  return z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean)
        : [],
    )
}

export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    // CORS — empty in development means "reflect any origin" (main.ts's
    // concern, not this schema's); outside development an empty list means
    // no cross-origin requests are allowed at all (fail closed) until a
    // real frontend origin is configured.
    CORS_ORIGIN: corsOriginList(),

    // Auth
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    REFRESH_COOKIE_NAME: z.string().default('worldbinder_refresh'),
    COOKIE_DOMAIN: z.string().optional(),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'),

    // Mail (Mailpit locally; a real provider's SMTP credentials in production)
    SMTP_HOST: z.string().default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: booleanString('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().default('Worldbinder <noreply@worldbinder.local>'),

    // Object storage (MinIO locally; Cloudflare R2 or AWS S3 in production —
    // distinct var names from the compose-facing MINIO_ROOT_USER/PASSWORD,
    // same split as SMTP_* app vars vs MAILPIT_* compose vars).
    STORAGE_ENDPOINT: z.string().url().default('http://127.0.0.1:9000'),
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_BUCKET: z.string().default('worldbinder-dev'),
    STORAGE_ACCESS_KEY_ID: z.string().default('worldbinder'),
    STORAGE_SECRET_ACCESS_KEY: z.string().default('worldbinder-dev-secret'),
    // MinIO needs path-style requests; real S3/R2 typically don't.
    STORAGE_FORCE_PATH_STYLE: booleanString('true'),
  })
  .superRefine((values, ctx) => {
    // `test` is exempt alongside `development`, not just production-only —
    // CI's integration-tests job (see .github/workflows/ci.yml) runs with
    // NODE_ENV=test against ephemeral service containers that use these
    // same dev-shaped storage credentials and deliberately doesn't
    // override them, only JWT_ACCESS_SECRET. `test` environments are
    // inherently ephemeral/local-infra, not a real deploy target.
    if (values.NODE_ENV === 'development' || values.NODE_ENV === 'test') return
    for (const [key, devOnlyValue] of Object.entries(KNOWN_DEV_ONLY_VALUES)) {
      if (values[key as keyof typeof KNOWN_DEV_ONLY_VALUES] === devOnlyValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is still set to its local-dev-only value — generate a real one before running outside development`,
        })
      }
    }
  })

export type ApiEnv = z.infer<typeof apiEnvSchema>

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  STORAGE_ENDPOINT: z.string().url().default('http://127.0.0.1:9000'),
  STORAGE_REGION: z.string().default('us-east-1'),
  STORAGE_BUCKET: z.string().default('worldbinder-dev'),
  STORAGE_ACCESS_KEY_ID: z.string().default('worldbinder'),
  STORAGE_SECRET_ACCESS_KEY: z.string().default('worldbinder-dev-secret'),
  STORAGE_FORCE_PATH_STYLE: booleanString('true'),
})

export type WorkerEnv = z.infer<typeof workerEnvSchema>
