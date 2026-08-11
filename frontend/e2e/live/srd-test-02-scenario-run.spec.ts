import { test, expect } from '@playwright/test'
import {
  joinOperatorTraining,
  loginAsInstructorLive,
  loginAsOperatorLive,
  setSessionSpeedViaUi,
  startSessionFromList,
  stopSessionViaUi,
  uiSeedStack,
  waitForAlarm,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-02 subset — timed fault scenario run; assert via AlarmBanner. */
test.describe('SRD TEST-02 scenario run (live)', () => {
  test('import timed-fault scenario → start → alarm appears in operator HMI', async ({
    browser,
  }) => {
    // Fixture uses ramp_seconds=30 + severity 100; at 10× wall time ≈ 10–15s
    // after fault at model_time=10 until PRSA 204 H alarm.
    test.setTimeout(180_000)
    const instructor = await browser.newContext()
    const iPage = await instructor.newPage()
    await loginAsInstructorLive(iPage)

    const seed = await uiSeedStack(iPage, {
      scenarioName: `E2E Fault Run ${Date.now().toString(36)}`,
      atModelTime: 10,
      start: false,
    })
    await startSessionFromList(iPage, seed.sessionId)
    await setSessionSpeedViaUi(iPage, seed.sessionId, 10)

    const operator = await browser.newContext()
    const oPage = await operator.newPage()
    await loginAsOperatorLive(oPage)
    await joinOperatorTraining(oPage, seed.sessionId)

    await waitForAlarm(oPage, { timeout: 90_000 })

    await iPage.goto('/sessions')
    await iPage.waitForLoadState('networkidle')
    const row = iPage.locator(`tr[data-row-key="${seed.sessionId}"]`)
    await expect(row.getByText('Идёт')).toBeVisible({ timeout: 15000 })

    await stopSessionViaUi(iPage, seed.sessionId)
    await instructor.close()
    await operator.close()
  })
})
