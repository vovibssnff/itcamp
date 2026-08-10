import { test, expect } from '@playwright/test'
import {
  apiSeedStack,
  createAndOpenSession,
  loginAsInstructorLive,
  loginAsOperatorLive,
  startSessionFromList,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-03 — operator in session + instructor observe (RO). */
test.describe('SRD TEST-03 observe (live)', () => {
  test('parallel operator training + instructor observe without controls', async ({ browser }) => {
    test.setTimeout(180_000)
    const seed = await apiSeedStack({
      scenarioName: `E2E Observe ${Date.now().toString(36)}`,
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
    await opPage.goto(`/sessions/${sessionId}/operator`)
    const start = opPage.getByTestId('training-start')
    if (await start.isVisible({ timeout: 8000 }).catch(() => false)) {
      await start.click()
    }

    await instructorPage.goto(`/sessions/${sessionId}/observe`)
    await expect(instructorPage.getByTestId('session-observe')).toBeVisible({ timeout: 20000 })
    await expect(instructorPage.getByText('Наблюдение')).toBeVisible()
    await expect(instructorPage.getByTestId('training-start')).toHaveCount(0)
    await expect(instructorPage.getByRole('button', { name: /Завершить тренировку/ })).toHaveCount(
      0,
    )

    await instructor.close()
    await operator.close()
  })
})
