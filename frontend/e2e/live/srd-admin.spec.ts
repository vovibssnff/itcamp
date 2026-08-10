import { test, expect } from '@playwright/test'
import { loginAsAdminLive, loginAsInstructorLive, expectRedirectAwayFrom } from './helpers'

test.describe.configure({ mode: 'serial' })

/** Admin matrix — users list RO; instructor denied. */
test.describe('SRD admin (live)', () => {
  test('admin users list is read-only LDAP notice or table', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsAdminLive(page)
    await page.goto('/admin/users')
    await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible({
      timeout: 15000,
    })
    // LDAP read-only notice is rendered when not in mock mode.
    await expect(page.getByText(/учётные записи ведутся во внешнем каталоге/i)).toBeVisible({
      timeout: 10000,
    })
    // No "Новый пользователь" / create button in live (LDAP) mode.
    await expect(page.getByRole('button', { name: /новый пользователь/i })).toHaveCount(0)
    // No edit or delete icons — mutation columns are hidden in live mode.
    await expect(page.locator('.anticon-edit')).toHaveCount(0)
    await expect(page.locator('.anticon-delete')).toHaveCount(0)
  })

  test('instructor cannot open admin users', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsInstructorLive(page)
    await expectRedirectAwayFrom(page, '/admin/users')
  })
})
