import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('TEST-06 / TEST-07: Exam flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator')
  })

  test('exam screen shows title and timer', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await expect(page.getByText('Квалификационный экзамен')).toBeVisible()
    // Timer format MM:SS
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^\d{2}:\d{2}$/ })
        .first(),
    ).toBeVisible()
  })

  test('exam shows finish control', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await expect(page.getByRole('button', { name: 'Завершить' })).toBeVisible()
  })

  test('exam has HMI canvas', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('exam finish button triggers confirmation', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await page.getByRole('button', { name: 'Завершить' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.ant-modal-confirm-title')).toHaveText(
      'Завершить экзамен досрочно?',
    )
  })
})

test.describe('TEST-08 / TEST-09: Report and replay', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator')
  })

  test('report screen shows score', async ({ page }) => {
    await page.goto('/reports/sess-002')
    await expect(page.getByText('Результаты обучения')).toBeVisible()
    // Score value visible
    await expect(
      page
        .locator('div')
        .filter({ hasText: /^\d{2,3}$/ })
        .first(),
    ).toBeVisible()
  })

  test('report shows AI analysis section', async ({ page }) => {
    await page.goto('/reports/sess-002')
    await expect(page.getByText('Анализ ИИ')).toBeVisible()
  })

  test('report has download PDF button', async ({ page }) => {
    await page.goto('/reports/sess-002')
    await expect(page.getByRole('button', { name: 'Скачать PDF' })).toBeVisible()
  })

  test('replay screen shows timeline slider', async ({ page }) => {
    await page.goto('/reports/sess-002/replay')
    await expect(page.getByText('Воспроизведение')).toBeVisible()
    await expect(page.locator('.ant-slider')).toBeVisible()
  })
})
