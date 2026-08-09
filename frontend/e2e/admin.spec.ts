import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('TEST-10: Admin screens', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
  })

  test('admin can access users screen', async ({ page }) => {
    await page.goto('/admin/users')
    await expect(page.getByText('Пользователи')).toBeVisible()
  })

  test('users screen shows existing users', async ({ page }) => {
    await page.goto('/admin/users')
    await expect(page.getByText('admin')).toBeVisible()
    await expect(page.getByText('instructor')).toBeVisible()
    await expect(page.getByText('operator')).toBeVisible()
  })

  test('can open create user modal', async ({ page }) => {
    await page.goto('/admin/users')
    await page.getByRole('button', { name: 'Новый пользователь' }).click()
    await expect(page.getByText('Новый пользователь')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeVisible()
  })

  test('system screen shows metrics', async ({ page }) => {
    await page.goto('/admin/system')
    await expect(page.getByText('Система')).toBeVisible()
    await expect(page.getByText('Версия приложения')).toBeVisible()
  })
})

test.describe('TEST-11: Role-based access control', () => {
  test('operator cannot access instructor routes', async ({ page }) => {
    await loginAs(page, 'operator')
    await page.goto('/templates')
    // Should be redirected away from templates
    await expect(page).not.toHaveURL('/templates')
  })

  test('operator cannot access admin routes', async ({ page }) => {
    await loginAs(page, 'operator')
    await page.goto('/admin/users')
    await expect(page).not.toHaveURL('/admin/users')
  })

  test('instructor cannot access admin routes', async ({ page }) => {
    await loginAs(page, 'instructor')
    await page.goto('/admin/users')
    await expect(page).not.toHaveURL('/admin/users')
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page).toHaveURL(/\/login/)
  })
})
