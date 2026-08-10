import { expect, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { totp } from '../totp'

const HERE = dirname(fileURLToPath(import.meta.url))
const LIVE_DIR = join(HERE, '..')
const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:8088'

export type LiveRole = 'instructor' | 'admin' | 'operator'

const CREDS: Record<
  LiveRole,
  { login: string; password: string; secretFile: string; envSecret?: string }
> = {
  instructor: {
    login: process.env.E2E_INSTRUCTOR_LOGIN ?? 'instructor',
    password: process.env.E2E_INSTRUCTOR_PASS ?? 'instructor123',
    secretFile: join(LIVE_DIR, '.instructor-mfa-secret'),
    envSecret: process.env.E2E_MFA_SECRET ?? process.env.E2E_INSTRUCTOR_MFA_SECRET,
  },
  admin: {
    login: process.env.E2E_ADMIN_LOGIN ?? 'admin',
    password: process.env.E2E_ADMIN_PASS ?? 'admin123',
    secretFile: join(LIVE_DIR, '.admin-mfa-secret'),
    envSecret: process.env.E2E_ADMIN_MFA_SECRET,
  },
  operator: {
    login: process.env.E2E_OPERATOR_LOGIN ?? 'operator',
    password: process.env.E2E_OPERATOR_PASS ?? 'operator123',
    secretFile: join(LIVE_DIR, '.operator-mfa-secret'),
  },
}

function loadPersistedSecret(role: 'instructor' | 'admin'): string | undefined {
  const c = CREDS[role]
  if (c.envSecret) return c.envSecret
  if (existsSync(c.secretFile)) return readFileSync(c.secretFile, 'utf8').trim()
  return undefined
}

function persistSecret(role: 'instructor' | 'admin', secret: string) {
  const file = CREDS[role].secretFile
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, secret, 'utf8')
}

async function resolveMfaSecret(role: 'instructor' | 'admin'): Promise<string> {
  const { login, password } = CREDS[role]
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ login, password }),
  })
  const data = (await res.json()) as {
    mfa_required?: boolean
    enrollment_token?: string
    secret?: string
    access_token?: string
  }
  if (data.access_token) {
    const cached = loadPersistedSecret(role)
    if (cached) return cached
    throw new Error(`${role}: login returned tokens without MFA; cannot obtain TOTP secret`)
  }
  if (!data.mfa_required) {
    throw new Error(`${role}: unexpected login response: ${JSON.stringify(data)}`)
  }
  if (data.secret) {
    persistSecret(role, data.secret)
    return data.secret
  }
  if (data.enrollment_token) {
    const enr = await fetch(`${API_BASE}/api/v1/auth/mfa/enrollment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.enrollment_token}`,
        Accept: 'application/json',
      },
    })
    if (!enr.ok) throw new Error(`${role} enrollment failed: ${enr.status} ${await enr.text()}`)
    const body = (await enr.json()) as { secret: string }
    persistSecret(role, body.secret)
    return body.secret
  }
  const cached = loadPersistedSecret(role)
  if (cached) return cached
  throw new Error(
    `${role} MFA already enrolled but no secret cached. Set E2E_${role.toUpperCase()}_MFA_SECRET or wipe auth DB.`,
  )
}

/** Stub users appear in GET /users only after first successful login. */
export async function ensureOperatorProvisioned() {
  const { login, password } = CREDS.operator
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ login, password }),
  })
  if (!res.ok) {
    throw new Error(`operator provision login failed: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as { access_token?: string; mfa_required?: boolean }
  if (!data.access_token) {
    throw new Error(`operator provision unexpected response: ${JSON.stringify(data)}`)
  }
}

async function loginWithMfa(page: Page, role: 'instructor' | 'admin') {
  const { login, password } = CREDS[role]
  const secret = await resolveMfaSecret(role)

  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/login')
    await page.getByPlaceholder('Ivanov.II').fill(login)
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: /Войти/ }).click()

    const mfaInput = page.getByPlaceholder('123456')
    const rateLimited = page.getByText(/too many|rate|слишком много|429/i)
    try {
      await expect(mfaInput.or(rateLimited)).toBeVisible({ timeout: 20000 })
    } catch {
      await page.waitForTimeout(15_000)
      continue
    }
    if (await rateLimited.isVisible().catch(() => false)) {
      await page.waitForTimeout(15_000)
      continue
    }

    const codeEl = page.locator('code').first()
    if (await codeEl.isVisible().catch(() => false)) {
      const uiSecret = (await codeEl.textContent())?.trim()
      if (uiSecret) persistSecret(role, uiSecret)
    }

    await mfaInput.fill(totp(loadPersistedSecret(role) ?? secret))
    await page.getByRole('button', { name: /Войти/ }).click()
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 })
      return
    } catch {
      await page.waitForTimeout(5_000)
    }
  }
  throw new Error(`${role}: MFA UI login failed after retries`)
}

export async function loginAsInstructorLive(page: Page) {
  await loginWithMfa(page, 'instructor')
}

export async function loginAsAdminLive(page: Page) {
  await loginWithMfa(page, 'admin')
}

export async function loginAsOperatorLive(page: Page) {
  const { login, password } = CREDS.operator
  await ensureOperatorProvisioned()
  await page.goto('/login')
  await page.getByPlaceholder('Ivanov.II').fill(login)
  await page.getByPlaceholder('••••••••').fill(password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 }),
    page.getByRole('button', { name: /Войти/ }).click(),
  ])
}

export async function logoutLive(page: Page) {
  await page.locator('[class*="userChip"]').click()
  await page.getByRole('menuitem', { name: /Выйти|Logout|logout/i }).click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
}

export { API_BASE, CREDS }
