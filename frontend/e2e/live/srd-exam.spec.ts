import { test, expect } from '@playwright/test'
import {
  finishExamViaUi,
  loginAsInstructorLive,
  loginAsOperatorLive,
  startSessionFromList,
  uiSeedStack,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** Exam mode — no AI panel; finish path; score badge appears. */
test.describe('SRD exam session (live)', () => {
  test('exam session → operator exam UI → finish', async ({ browser }) => {
    test.setTimeout(180_000)

    const instructor = await browser.newContext()
    const instructorPage = await instructor.newPage()
    await loginAsInstructorLive(instructorPage)
    const seed = await uiSeedStack(instructorPage, {
      scenarioName: `E2E Exam ${Date.now().toString(36)}`,
      atModelTime: 300,
      mode: 'exam',
      start: false,
    })
    await startSessionFromList(instructorPage, seed.sessionId)
    await expect(
      instructorPage.locator(`tr[data-row-key="${seed.sessionId}"]`).getByText('Идёт'),
    ).toBeVisible({ timeout: 60000 })

    const operator = await browser.newContext()
    const opPage = await operator.newPage()
    await loginAsOperatorLive(opPage)
    await opPage.goto(`/sessions/${seed.sessionId}/exam`)
    await expect(opPage.getByText('Квалификационный экзамен')).toBeVisible({ timeout: 20000 })
    await expect(opPage.getByText('ИИ-ассистент', { exact: true })).toHaveCount(0)

    await finishExamViaUi(opPage)
    await expect
      .poll(() => new URL(opPage.url()).pathname, { timeout: 30000 })
      .not.toMatch(/\/exam$/)

    await instructorPage.goto('/sessions')
    await instructorPage.waitForLoadState('networkidle')
    const row = instructorPage.locator(`tr[data-row-key="${seed.sessionId}"]`)
    await expect(row.getByText(/Остановлена|Завершена/)).toBeVisible({ timeout: 60000 })
    await expect(row.getByTestId('session-score')).toBeVisible({ timeout: 30000 })

    await instructor.close()
    await operator.close()
  })
})
