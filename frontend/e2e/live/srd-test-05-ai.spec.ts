import { test, expect } from '@playwright/test'
import {
  joinOperatorTraining,
  loginAsInstructorLive,
  loginAsOperatorLive,
  startSessionFromList,
  stopSessionViaUi,
  uiSeedStack,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/**
 * SRD TEST-05 — AI training UI.
 * Adaptive generate is mock-only (no gw `/api/ai/*`) — skipped with reason.
 */
test.describe('SRD TEST-05 AI (live)', () => {
  test('training shows AI assistant panel', async ({ browser }) => {
    test.setTimeout(180_000)

    const instructor = await browser.newContext()
    const iPage = await instructor.newPage()
    await loginAsInstructorLive(iPage)
    const seed = await uiSeedStack(iPage, {
      scenarioName: `E2E AI ${Date.now().toString(36)}`,
      atModelTime: 120,
      start: false,
    })
    await startSessionFromList(iPage, seed.sessionId)

    const operator = await browser.newContext()
    const oPage = await operator.newPage()
    await loginAsOperatorLive(oPage)
    await joinOperatorTraining(oPage, seed.sessionId)
    await expect(oPage.getByText('ИИ-ассистент', { exact: true })).toBeVisible({ timeout: 20000 })

    await stopSessionViaUi(iPage, seed.sessionId)
    await instructor.close()
    await operator.close()
  })

  test.skip('Adaptive scenario generate', async () => {
    // `/api/ai/*` is mock-only; not exposed on the gateway.
  })
})
