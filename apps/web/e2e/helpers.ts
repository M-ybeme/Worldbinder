import { expect, type Page } from '@playwright/test'
import { execSync } from 'node:child_process'

export const MAILPIT_URL = 'http://127.0.0.1:8025'
export const PASSWORD = 'verify-pass-123456'

/**
 * Real IP-scoped rate limits (registerPerIp etc.) apply to Playwright the
 * same as any client — running multiple specs' worth of registrations
 * against the same dev Redis in one hour exhausts them fast. Clear before
 * each test rather than loosening the limit for test convenience, mirroring
 * the same call the Jest e2e suites make in their own `beforeAll`.
 */
export function clearRateLimits(): void {
  try {
    execSync(
      `docker exec worldbinder-redis-1 sh -c "redis-cli --scan --pattern 'ratelimit:*' | xargs -r redis-cli DEL"`,
    )
  } catch {
    // Best-effort: if the container name/setup differs, tests will surface
    // real rate-limit failures instead of silently passing incorrectly.
  }
}

interface MailpitMessage {
  ID: string
  Subject: string
  To: { Address: string }[]
}

export async function findEmailLink(email: string, subjectIncludes: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/messages`)).json()) as {
      messages: MailpitMessage[]
    }
    const match = list.messages.find(
      (m) => m.Subject.includes(subjectIncludes) && m.To.some((t) => t.Address === email),
    )
    if (match) {
      const detail = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`)).json()) as {
        HTML: string
      }
      const hrefMatch = /href="([^"]+)"/.exec(detail.HTML)
      if (hrefMatch) return hrefMatch[1]
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No "${subjectIncludes}" email found for ${email} after polling Mailpit`)
}

export async function registerAndVerify(
  page: Page,
  email: string,
  displayName: string,
): Promise<void> {
  await page.goto('/register')
  await page.getByLabel('Display name').fill(displayName)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()

  const verifyLink = await findEmailLink(email, 'Verify')
  await page.goto(verifyLink)
  // Generous timeout: the first real navigation to a route in a fresh dev
  // session can trigger Vite's on-demand dependency (re-)optimization,
  // which reloads the page mid-flight — the API call itself is fast.
  await expect(page.getByText(/email verified/i)).toBeVisible({ timeout: 20_000 })
}

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/account\/profile$/)
}

/** Registers, verifies, logs in, and creates a campaign — returns the page
 * already sitting on the new campaign's overview. */
export async function setUpOwnerWithCampaign(
  page: Page,
  displayName: string,
  campaignName: string,
): Promise<void> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const emailSlug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const email = `${emailSlug}-${stamp}@verify.local`

  await registerAndVerify(page, email, displayName)
  await login(page, email)

  await page.goto('/app/campaigns')
  await page.getByLabel('Name').fill(campaignName)
  await page.getByRole('button', { name: 'Create campaign' }).click()
  await page.getByRole('link', { name: campaignName }).click()
  await expect(page.getByRole('heading', { name: campaignName })).toBeVisible()
}
