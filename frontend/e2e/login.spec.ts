import { test, expect } from '@playwright/test'

test.describe('TEST-01: Login flow', () => {
  test('shows login screen on first visit', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('Тренажёрный комплекс').first()).toBeVisible()
    await expect(page.getByText('Авторизация')).toBeVisible()
  })

  test('login as operator with correct credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Ivanov.II').fill('operator')
    await page.getByPlaceholder('••••••••').fill('operator')
    await page.getByRole('button', { name: /Войти/ }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('login as instructor', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Ivanov.II').fill('instructor')
    await page.getByPlaceholder('••••••••').fill('instructor')
    await page.getByRole('button', { name: /Войти/ }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('login as admin', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Ivanov.II').fill('admin')
    await page.getByPlaceholder('••••••••').fill('admin')
    await page.getByRole('button', { name: /Войти/ }).click()
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Ivanov.II').fill('wrong')
    await page.getByPlaceholder('••••••••').fill('wrong')
    await page.getByRole('button', { name: /Войти/ }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login button disabled when fields empty', async ({ page }) => {
    await page.goto('/login')
    const btn = page.getByRole('button', { name: /Войти/ })
    await expect(btn).toBeDisabled()
  })
})
