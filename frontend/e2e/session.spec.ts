import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('TEST-03 / TEST-04: Session lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'instructor')
  })

  test('instructor console shows active sessions', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page.getByText('Консоль инструктора')).toBeVisible()
    await expect(page.getByText('Петров П.П.')).toBeVisible()
  })

  test('session shows status badge', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page.getByText('Идёт')).toBeVisible()
  })

  test('can navigate to session observation', async ({ page }) => {
    await page.goto('/sessions/sess-001/observe')
    await expect(page.getByText('НАБЛЮДЕНИЕ')).toBeVisible()
  })

  test('observe screen shows HMI canvas', async ({ page }) => {
    await page.goto('/sessions/sess-001/observe')
    // Canvas element should be present
    await expect(page.locator('canvas')).toBeVisible()
  })
})

test.describe('TEST-05: Operator training session', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator')
  })

  test('operator can enter training screen', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('training screen shows ESD button', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.getByRole('button', { name: 'ESD' })).toBeVisible()
  })

  test('training screen shows alarm and trends tabs', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.getByText('Аварии')).toBeVisible()
    await expect(page.getByText('Тренды')).toBeVisible()
  })
})
