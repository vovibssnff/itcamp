import { test, expect } from '@playwright/test'
import {
  ensureOperatorProvisioned,
  expectRedirectAwayFrom,
  loginAsAdminLive,
  loginAsInstructorLive,
  loginAsOperatorLive,
  logoutLive,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-11 / AUTH — MFA roles + RBAC redirects. */
test.describe('SRD TEST-11 auth RBAC (live)', () => {
  test('operator login and blocked from instructor/admin routes', async ({ page }) => {
    test.setTimeout(120_000)
    await ensureOperatorProvisioned()
    await loginAsOperatorLive(page)
    await expect(page).not.toHaveURL(/\/login/)

    await expectRedirectAwayFrom(page, '/templates')
    await expect(page).toHaveURL(/\/($|home|sessions|operator)/)

    await expectRedirectAwayFrom(page, '/admin/users')
    await expect(page).toHaveURL(/\/($|home|sessions|operator)/)

    await logoutLive(page)
    await expect(page).toHaveURL(/\/login/)
  })

  test('instructor MFA login; blocked from admin', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsInstructorLive(page)
    await page.goto('/templates')
    await expect(page.getByRole('heading', { name: /Шаблоны установок/i })).toBeVisible({
      timeout: 15000,
    })

    await expectRedirectAwayFrom(page, '/admin/users')
    await logoutLive(page)
  })

  test('admin MFA login; users list visible', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsAdminLive(page)
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible({
      timeout: 15000,
    })
    await logoutLive(page)
  })
})
