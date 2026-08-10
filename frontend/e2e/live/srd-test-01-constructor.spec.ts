import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import {
  apiImportComponents,
  apiImportTemplate,
  apiToken,
  fixturesDir,
  loginAsInstructorLive,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-01 — ≥10-node graph (API seed) → editor validate → list. */
test.describe('SRD TEST-01 constructor (live)', () => {
  test('import large facility → validate → appears in list', async ({ page }) => {
    test.setTimeout(120_000)
    const token = await apiToken('instructor')
    await apiImportComponents(token)
    const tpl = await apiImportTemplate(token, join(fixturesDir(), 'template.large.json'))

    await loginAsInstructorLive(page)
    await page.goto(`/templates/${tpl.id}/edit`)
    await expect(page.getByRole('button', { name: 'Проверить' })).toBeVisible({ timeout: 20000 })

    await page.getByRole('button', { name: 'Проверить' }).click()
    await expect(page.getByText('Граф валиден')).toBeVisible({ timeout: 15000 })

    // Imported draft is already persisted; assert list entry.
    await page.goto('/templates')
    await expect(page.getByText(tpl.name).first()).toBeVisible({ timeout: 15000 })
  })
})
