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

/** SRD TEST-03 — operator in session + instructor observe (RO). */
test.describe('SRD TEST-03 observe (live)', () => {
  test('parallel operator training + instructor observe without controls', async ({ browser }) => {
    test.setTimeout(180_000)

    const instructor = await browser.newContext()
    const instructorPage = await instructor.newPage()
    await loginAsInstructorLive(instructorPage)
    const seed = await uiSeedStack(instructorPage, {
      scenarioName: `E2E Observe ${Date.now().toString(36)}`,
      atModelTime: 120,
      start: false,
    })
    await startSessionFromList(instructorPage, seed.sessionId)

    const operator = await browser.newContext()
    const opPage = await operator.newPage()
    await loginAsOperatorLive(opPage)
    await joinOperatorTraining(opPage, seed.sessionId)

    await instructorPage.goto(`/sessions/${seed.sessionId}/observe`)
    await expect(instructorPage.getByTestId('session-observe')).toBeVisible({ timeout: 20000 })
    await expect(instructorPage.getByText('Наблюдение')).toBeVisible()
    await expect(instructorPage.getByTestId('training-start')).toHaveCount(0)
    await expect(instructorPage.getByRole('button', { name: /Завершить тренировку/ })).toHaveCount(
      0,
    )

    await stopSessionViaUi(instructorPage, seed.sessionId)
    await instructor.close()
    await operator.close()
  })
})
