import { type Page } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LIVE_DIR = join(HERE, '..')
const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:8088'

export type LiveRole = 'instructor' | 'admin' | 'operator'

const CREDS: Record<LiveRole, { login: string; password: string }> = {
  instructor: {
    login: process.env.E2E_INSTRUCTOR_LOGIN ?? 'instructor',
    password: process.env.E2E_INSTRUCTOR_PASS ?? 'instructor123',
  },
  admin: {
    login: process.env.E2E_ADMIN_LOGIN ?? 'admin',
    password: process.env.E2E_ADMIN_PASS ?? 'admin123',
  },
  operator: {
    login: process.env.E2E_OPERATOR_LOGIN ?? 'operator',
    password: process.env.E2E_OPERATOR_PASS ?? 'operator123',
  },
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
  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) {
    throw new Error(`operator provision unexpected response: ${JSON.stringify(data)}`)
  }
}

/** Password-only UI login for live stack users. */
async function loginWithPassword(page: Page, role: LiveRole) {
  const { login, password } = CREDS[role]
  await page.goto('/login')
  await page.getByPlaceholder('Ivanov.II').fill(login)
  await page.getByPlaceholder('••••••••').fill(password)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 }),
    page.getByRole('button', { name: /Войти/ }).click(),
  ])
}

export async function loginAsInstructorLive(page: Page) {
  await loginWithPassword(page, 'instructor')
}

export async function loginAsAdminLive(page: Page) {
  await loginWithPassword(page, 'admin')
}

export async function loginAsOperatorLive(page: Page) {
  await ensureOperatorProvisioned()
  await loginWithPassword(page, 'operator')
}

export async function logoutLive(page: Page) {
  await page.locator('[class*="userChip"]').click()
  await page.getByRole('menuitem', { name: /Выйти|Logout|logout/i }).click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
}

export { API_BASE, CREDS, LIVE_DIR }
