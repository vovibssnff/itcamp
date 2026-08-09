import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('TEST-03 / TEST-04: Session lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'instructor')
  })

  test('instructor console shows active sessions', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page.getByText('Консоль управления')).toBeVisible()
    await expect(page.getByText('Петров П.П.').first()).toBeVisible()
  })

  test('session shows status badge', async ({ page }) => {
    await page.goto('/sessions')
    await expect(page.getByText('Идёт')).toBeVisible()
  })

  test('can navigate to session observation', async ({ page }) => {
    await page.goto('/sessions/sess-001/observe')
    await expect(page.getByText('Наблюдение')).toBeVisible()
  })

  test('observe screen shows HMI canvas', async ({ page }) => {
    await page.goto('/sessions/sess-001/observe')
    // Konva mounts multiple canvas layers — any one is enough
    await expect(page.locator('canvas').first()).toBeVisible()
  })
})

test.describe('TEST-05: Operator training session', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator')
  })

  test('operator can enter training screen', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('training screen shows start control', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible()
  })

  test('training screen shows alarm journal and trends', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.getByText('Журнал аварий').first()).toBeVisible()
    await expect(page.getByText(/Тренды/)).toBeVisible()
  })
})
