import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('TEST-06 / TEST-07: Exam flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator')
  })

  test('exam screen shows EXAM label and timer', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await expect(page.getByText('ЭКЗАМЕН')).toBeVisible()
    // Timer format MM:SS
    await expect(
      page
        .locator('span')
        .filter({ hasText: /^\d{2}:\d{2}$/ })
        .first(),
    ).toBeVisible()
  })

  test('exam shows ESD button', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await expect(page.getByRole('button', { name: 'ESD' })).toBeVisible()
  })

  test('exam has HMI canvas', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await expect(page.locator('canvas')).toBeVisible()
  })

  test('exam finish button triggers confirmation', async ({ page }) => {
    await page.goto('/sessions/sess-001/exam')
    await page.getByRole('button', { name: 'Завершить' }).click()
    await expect(page.getByText('Завершить экзамен досрочно?')).toBeVisible()
  })
})

test.describe('TEST-08 / TEST-09: Report and replay', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'operator')
  })

  test('report screen shows score', async ({ page }) => {
    await page.goto('/reports/sess-002')
    await expect(page.getByText('Отчёт об обучении')).toBeVisible()
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
