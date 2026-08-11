import { test, expect } from '@playwright/test'
import {
  loginAsInstructorLive,
  startSessionFromList,
  stopSessionViaUi,
  uiSeedStack,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** FR-ASSESS / E2E-009 — report create → queued (UI only). */
test.describe('SRD report (live)', () => {
  test('after session → queue report → report route', async ({ page }) => {
    test.setTimeout(180_000)
    await loginAsInstructorLive(page)
    const seed = await uiSeedStack(page, {
      scenarioName: `E2E Report ${Date.now().toString(36)}`,
      atModelTime: 60,
      start: false,
    })
    await startSessionFromList(page, seed.sessionId)
    await stopSessionViaUi(page, seed.sessionId)

    await page.goto('/sessions')
    await page.waitForLoadState('networkidle')
    const sessionRow = page.locator(`tr[data-row-key="${seed.sessionId}"]`)
    await expect(sessionRow).toBeVisible({ timeout: 15000 })
    const reportBtn = sessionRow.locator('button:has(.anticon-file-text)')
    await expect(reportBtn).toBeVisible({ timeout: 10000 })
    await reportBtn.click()

    await expect(page.getByText(/Отчёт поставлен в очередь/i)).toBeVisible({ timeout: 20000 })
    await page.waitForURL(/\/reports\//, { timeout: 30000 })
  })
})
