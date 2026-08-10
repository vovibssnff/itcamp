import { test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  apiImportComponents,
  apiToken,
  fixturesDir,
  loginAsInstructorLive,
  uploadJson,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-04 — template import, copy, validate, soft delete. */
test.describe('SRD TEST-04 templates (live)', () => {
  test('import → list → copy → validate → delete', async ({ page }) => {
    test.setTimeout(120_000)
    const token = await apiToken('instructor')
    await apiImportComponents(token)

    await loginAsInstructorLive(page)
    const name = `E2E Tmpl ${Date.now().toString(36)}`
    const fx = fixturesDir()
    const raw = JSON.parse(readFileSync(join(fx, 'template.min.json'), 'utf8')) as { name: string }
    raw.name = name
    const path = join(mkdtempSync(join(tmpdir(), 'ktk-tmpl-')), 't.json')
    writeFileSync(path, JSON.stringify(raw))

    await page.goto('/templates')
    await uploadJson(page, 'Импорт установки', path)
    await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })
    await page.getByRole('button', { name: 'Проверить' }).click()
    await expect(page.getByText('Граф валиден')).toBeVisible({ timeout: 15000 })

    await page.goto('/templates')
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })

    const row = page.locator('.tbl-row', { hasText: name }).first()
    await row.getByTitle('Копировать').click()
    await expect(page.getByText('Шаблон скопирован')).toBeVisible({ timeout: 15000 })
    await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })

    await page.goto('/templates')
    await expect(page.getByRole('heading', { name: /Шаблоны установок/i })).toBeVisible({
      timeout: 15000,
    })
    const copyLabel = page
      .getByText(new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*копия`, 'i'))
      .first()
    await expect(copyLabel).toBeVisible({ timeout: 15000 })

    const copyRow = page
      .locator('.tbl-row', { hasText: /копия/i })
      .filter({ hasText: name })
      .first()
    await copyRow.locator('button.btn-danger').click()
    await expect(page.getByText('Шаблон удалён')).toBeVisible({ timeout: 10000 })
    await page.reload()
    await expect(
      page.locator('.tbl-row', { hasText: name }).filter({ hasText: /копия/i }),
    ).toHaveCount(0, {
      timeout: 15000,
    })
  })
})
