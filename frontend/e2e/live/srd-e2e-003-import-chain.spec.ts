import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import {
  createSessionViaUi,
  fixturesDir,
  loginAsInstructorLive,
  searchListFor,
  startSessionFromList,
  stopSessionViaUi,
  uploadJson,
  writeBoundScenarioFixture,
  writeBoundTemplateFixture,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** E2E-003 smoke: import library → facility → scenario → create/start session (UI only). */
test.describe('SRD E2E-003 import chain (live)', () => {
  test('upload library → facility → faults/scenario → start session', async ({ page }) => {
    test.setTimeout(180_000)
    const fx = fixturesDir()
    await loginAsInstructorLive(page)

    await page.goto('/components')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт библиотеки', join(fx, 'components.min.json'))
    await expect(page.getByText(/Импорт:/)).toBeVisible({ timeout: 15000 })

    await page.goto('/scenarios')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт неисправностей', join(fx, 'faults.min.json'))
    await expect(page.getByText(/Неисправности:/)).toBeVisible({ timeout: 15000 })

    const tpl = writeBoundTemplateFixture()
    await page.goto('/templates')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт установки', tpl.path)
    await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })
    const templateId = page.url().match(/\/templates\/([^/]+)\/edit/)?.[1]
    expect(templateId).toBeTruthy()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Проверить' }).click()
    await expect(page.getByText('Граф валиден')).toBeVisible({ timeout: 15000 })

    const sc = writeBoundScenarioFixture(templateId!, {
      name: `E2E Mini Scenario ${Date.now().toString(36)}`,
    })
    await page.goto('/scenarios')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт сценариев', sc.path)
    await expect(page.getByText(/Сценарии:/)).toBeVisible({ timeout: 15000 })
    await searchListFor(page, sc.name)

    const sessionId = await createSessionViaUi(page, {
      templateName: tpl.name,
      scenarioName: sc.name,
      mode: 'training',
    })
    await startSessionFromList(page, sessionId)
    await stopSessionViaUi(page, sessionId)
  })
})
