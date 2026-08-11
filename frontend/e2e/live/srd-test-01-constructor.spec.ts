import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import {
  fixturesDir,
  loginAsInstructorLive,
  uploadJson,
  writeBoundTemplateFixture,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-01 — ≥10-node graph via UI import → editor validate → list. */
test.describe('SRD TEST-01 constructor (live)', () => {
  test('import large facility → validate → appears in list', async ({ page }) => {
    test.setTimeout(120_000)
    await loginAsInstructorLive(page)

    await page.goto('/components')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт библиотеки', join(fixturesDir(), 'components.min.json'))
    await expect(page.getByText(/Импорт:/i)).toBeVisible({ timeout: 15000 })

    const tpl = writeBoundTemplateFixture({
      file: join(fixturesDir(), 'template.large.json'),
    })
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
  })
})
