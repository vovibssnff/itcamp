import { type Page } from '@playwright/test'

export async function loginAs(page: Page, role: 'operator' | 'instructor' | 'admin') {
  await page.goto('/login')
  await page.getByPlaceholder('ivanov.ii').fill(role)
  await page.getByPlaceholder('••••••••').fill(role)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL((url) => !url.pathname.includes('/login'))
}
