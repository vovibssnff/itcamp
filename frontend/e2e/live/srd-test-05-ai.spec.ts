import { test, expect } from '@playwright/test'
import {
  apiSeedStack,
  createAndOpenSession,
  loginAsInstructorLive,
  loginAsOperatorLive,
  startSessionFromList,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/**
 * SRD TEST-05 — AI training UI.
 * Adaptive generate is mock-only (no gw `/api/ai/*`) — skipped with reason.
 */
test.describe('SRD TEST-05 AI (live)', () => {
  test('training shows AI assistant panel', async ({ browser }) => {
    test.setTimeout(180_000)
    const seed = await apiSeedStack({
      scenarioName: `E2E AI ${Date.now().toString(36)}`,
      atModelTime: 120,
      start: false,
    })

    const instructor = await browser.newContext()
    const iPage = await instructor.newPage()
    await loginAsInstructorLive(iPage)
    const sessionId = await createAndOpenSession(iPage, {
      token: seed.token,
      templateId: seed.templateId,
      scenarioId: seed.scenarioId,
    })
    await startSessionFromList(iPage, sessionId)

    const operator = await browser.newContext()
    const oPage = await operator.newPage()
    await loginAsOperatorLive(oPage)
    await oPage.goto(`/sessions/${sessionId}/operator`)
    if (
      await oPage
        .getByTestId('training-start')
        .isVisible({ timeout: 8000 })
        .catch(() => false)
    ) {
      await oPage.getByTestId('training-start').click()
    }

    // Expand sidebar if collapsed
    const rail = oPage.getByText('Панель')
    if (await rail.isVisible().catch(() => false)) await rail.click()

    await expect(oPage.getByText('ИИ-ассистент', { exact: true })).toBeVisible({ timeout: 20000 })

    await instructor.close()
    await operator.close()
  })

  test.skip('Adaptive scenario generate', () => {
    // Backend Adaptive generate is not exposed via gateway in compose;
    // UI path remains mock-only (`frontend/src/mocks/handlers/ai.ts`).
  })
})
