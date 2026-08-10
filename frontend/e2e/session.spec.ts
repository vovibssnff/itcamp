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

  test('observe screen shows HMI mnemonic', async ({ page }) => {
    await page.goto('/sessions/sess-001/observe')
    await expect(page.locator('svg').first()).toBeVisible()
    await expect(page.getByText('К-1').first()).toBeVisible()
  })
})

test.describe('TEST-05: Operator training session', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator')
  })

  test('operator can enter training screen', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.locator('svg').first()).toBeVisible()
  })

  test('training screen shows start control', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.getByRole('button', { name: 'Начать тренировку' })).toBeVisible()
  })

  test('training screen shows AI assistant and trends', async ({ page }) => {
    await page.goto('/sessions/sess-001/operator')
    await expect(page.getByText('ИИ-ассистент').first()).toBeVisible()
    await expect(page.getByText(/Параметры|Тренды/)).toBeVisible()
  })
})
