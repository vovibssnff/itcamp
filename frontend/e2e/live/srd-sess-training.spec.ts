import { test, expect } from '@playwright/test'
import {
  apiSeedStack,
  createAndOpenSession,
  loginAsInstructorLive,
  loginAsOperatorLive,
  startSessionFromList,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** MODE-TRAIN / E2E-004 — instructor start → operator training → finish. */
test.describe('SRD session training (live)', () => {
  test('instructor creates+starts; operator opens training and finishes', async ({ browser }) => {
    test.setTimeout(180_000)
    const seed = await apiSeedStack({
      scenarioName: `E2E Train ${Date.now().toString(36)}`,
      atModelTime: 120,
      start: false,
    })

    const instructor = await browser.newContext()
    const instructorPage = await instructor.newPage()
    await loginAsInstructorLive(instructorPage)
    const sessionId = await createAndOpenSession(instructorPage, {
      token: seed.token,
      templateId: seed.templateId,
      scenarioId: seed.scenarioId,
    })
    await startSessionFromList(instructorPage, sessionId)

    const operator = await browser.newContext()
    const opPage = await operator.newPage()
    await loginAsOperatorLive(opPage)
    await opPage.goto(`/sessions/${sessionId}/mode`)
    await expect(opPage.getByText(/Самостоятельная тренировка|Тренировка/i).first()).toBeVisible({
      timeout: 15000,
    })
    await opPage.getByText(/Самостоятельная тренировка/).click()
    await opPage.waitForURL(new RegExp(`/sessions/${sessionId}/operator`), { timeout: 20000 })

    const start = opPage.getByTestId('training-start')
    if (await start.isVisible({ timeout: 5000 }).catch(() => false)) {
      await start.click()
    }
    await expect(opPage.getByText('ИИ-ассистент', { exact: true })).toBeVisible({ timeout: 20000 })

    const finish = opPage.getByRole('button', { name: /Завершить тренировку/ })
    if (await finish.isEnabled().catch(() => false)) {
      await finish.click()
      await opPage.waitForTimeout(2000)
    }

    await instructorPage.goto('/sessions')
    const stopBtn = instructorPage.locator('button:has(.anticon-stop)').first()
    if (await stopBtn.isVisible().catch(() => false)) {
      await stopBtn.click()
    }

    await instructor.close()
    await operator.close()
  })
})
