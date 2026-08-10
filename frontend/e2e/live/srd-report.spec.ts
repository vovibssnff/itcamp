import { test, expect } from '@playwright/test'
import {
  apiSeedStack,
  apiSessionAction,
  createAndOpenSession,
  loginAsInstructorLive,
  startSessionFromList,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** FR-ASSESS / E2E-009 — report create → queued (PDF UI may wait on assessment). */
test.describe('SRD report (live)', () => {
  test('after session → queue report → report route', async ({ page }) => {
    test.setTimeout(180_000)
    const seed = await apiSeedStack({
      scenarioName: `E2E Report ${Date.now().toString(36)}`,
      atModelTime: 60,
      start: false,
    })

    await loginAsInstructorLive(page)
    const sessionId = await createAndOpenSession(page, {
      token: seed.token,
      templateId: seed.templateId,
      scenarioId: seed.scenarioId,
    })
    await startSessionFromList(page, sessionId)

    try {
      await apiSessionAction(seed.token, sessionId, 'stop')
    } catch {
      const row = page.locator(`tr[data-row-key="${sessionId}"]`)
      const stop = row.locator('button:has(.anticon-stop)')
      if (await stop.isVisible().catch(() => false)) await stop.click()
    }

    await page.goto('/sessions')
    const sessionRow = page.locator(`tr[data-row-key="${sessionId}"]`)
    await expect(sessionRow).toBeVisible({ timeout: 15000 })
    const reportBtn = sessionRow.locator('button:has(.anticon-file-text)')
    await expect(reportBtn).toBeVisible({ timeout: 10000 })
    await reportBtn.click()

    await expect(page.getByText(/Отчёт поставлен в очередь/i)).toBeVisible({ timeout: 20000 })
    await page.waitForURL(/\/reports\//, { timeout: 30000 })
  })
})
