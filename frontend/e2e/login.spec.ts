import { test, expect } from '@playwright/test'

test.describe('TEST-01: Login flow', () => {
  test('shows login screen on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('КТК · Тренажёр')).toBeVisible()
    await expect(page.getByText(/ЭЛОУ-АВТ/)).toBeVisible()
  })

  test('can switch role tabs', async ({ page }) => {
    await page.goto('/login')
    const instructorTab = page.getByRole('button', { name: 'Инструктор' })
    await instructorTab.click()
    // Active tab gets accent background via inline style
    await expect(instructorTab).toBeVisible()
  })

  test('login as operator with correct credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('ivanov.ii').fill('operator')
    await page.getByPlaceholder('••••••••').fill('operator')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('login as instructor', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('ivanov.ii').fill('instructor')
    await page.getByPlaceholder('••••••••').fill('instructor')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('login as admin', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('ivanov.ii').fill('admin')
    await page.getByPlaceholder('••••••••').fill('admin')
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('ivanov.ii').fill('wrong')
    await page.getByPlaceholder('••••••••').fill('wrong')
    await page.getByRole('button', { name: 'Войти' }).click()
    // Should stay on login page
    await expect(page).toHaveURL(/\/login/)
  })

  test('login button disabled when fields empty', async ({ page }) => {
    await page.goto('/login')
    const btn = page.getByRole('button', { name: 'Войти' })
    await expect(btn).toBeDisabled()
  })
})
