import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import {
  fixturesDir,
  loginAsInstructorLive,
  uploadJson,
  writeBoundTemplateFixture,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-04 — import → list → copy → validate → delete via UI. */
test.describe('SRD TEST-04 templates (live)', () => {
  test('import → list → copy → validate → delete', async ({ page }) => {
    test.setTimeout(180_000)
    await loginAsInstructorLive(page)

    await page.goto('/components')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт библиотеки', join(fixturesDir(), 'components.min.json'))
    await expect(page.getByText(/Импорт:/i)).toBeVisible({ timeout: 15000 })

    const tpl = writeBoundTemplateFixture()
    await page.goto('/templates')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт установки', tpl.path)
    await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Проверить' }).click()
    await expect(page.getByText('Граф валиден')).toBeVisible({ timeout: 15000 })

    await page.goto('/templates')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(tpl.name).first()).toBeVisible({ timeout: 15000 })

    const row = page.locator('[class*="row"], tr').filter({ hasText: tpl.name }).first()
    await row.getByTitle('Копировать').click()
    await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })
    await expect(page.getByText(/\(копия\)/).first()).toBeVisible({ timeout: 15000 })

    await page.goto('/templates')
    await page.waitForLoadState('networkidle')
    const copyName = `${tpl.name} (копия)`
    await expect(page.getByText(copyName).first()).toBeVisible({ timeout: 15000 })
    const copyRow = page
      .locator('.tbl-row, [class*="tbl-row"], tr')
      .filter({ hasText: copyName })
      .first()
    page.once('dialog', (d) => void d.accept())
    await copyRow.locator('button.btn-danger').click()
    await expect(page.getByText('Шаблон удалён')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(copyName)).toHaveCount(0, { timeout: 15000 })
  })
})
