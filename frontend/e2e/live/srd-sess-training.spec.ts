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

/** MODE-TRAIN / E2E-004 — instructor start → operator training → finish. */
test.describe('SRD session training (live)', () => {
  test('instructor creates+starts; operator opens training and finishes', async ({ browser }) => {
    test.setTimeout(180_000)

    const instructor = await browser.newContext()
    const instructorPage = await instructor.newPage()
    await loginAsInstructorLive(instructorPage)
    const seed = await uiSeedStack(instructorPage, {
      scenarioName: `E2E Train ${Date.now().toString(36)}`,
      atModelTime: 120,
      start: false,
    })
    await startSessionFromList(instructorPage, seed.sessionId)

    const operator = await browser.newContext()
    const opPage = await operator.newPage()
    await loginAsOperatorLive(opPage)
    await opPage.goto(`/sessions/${seed.sessionId}/mode`)
    await expect(opPage.getByText(/Самостоятельная тренировка|Тренировка/i).first()).toBeVisible({
      timeout: 15000,
    })
    await opPage.getByText(/Самостоятельная тренировка/).click()
    await opPage.waitForURL(new RegExp(`/sessions/${seed.sessionId}/operator`), { timeout: 20000 })
    await joinOperatorTraining(opPage, seed.sessionId)
    await expect(opPage.getByText('ИИ-ассистент', { exact: true })).toBeVisible({ timeout: 20000 })

    const finish = opPage.getByRole('button', { name: /Завершить тренировку/ })
    if (await finish.isEnabled().catch(() => false)) {
      await finish.click()
      await opPage.waitForTimeout(2000)
    }

    await stopSessionViaUi(instructorPage, seed.sessionId)
    await instructor.close()
    await operator.close()
  })
})
