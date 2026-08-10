import { test, expect } from '@playwright/test'
import {
  apiCreateSession,
  apiFindOperatorId,
  apiSeedStack,
  apiSessionAction,
  finishExamViaUi,
  loginAsInstructorLive,
  loginAsOperatorLive,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** Exam mode — no AI panel; finish path. */
test.describe('SRD exam session (live)', () => {
  test('exam session → operator exam UI → finish', async ({ browser }) => {
    test.setTimeout(180_000)
    const seed = await apiSeedStack({
      scenarioName: `E2E Exam ${Date.now().toString(36)}`,
      atModelTime: 300,
      mode: 'exam',
      start: false,
    })
    const operatorId = await apiFindOperatorId(seed.token)
    const session = await apiCreateSession(seed.token, {
      templateId: seed.templateId,
      scenarioId: seed.scenarioId,
      operatorId,
      mode: 'exam',
    })
    await apiSessionAction(seed.token, session.id, 'start')

    const instructor = await browser.newContext()
    const instructorPage = await instructor.newPage()
    await loginAsInstructorLive(instructorPage)
    await instructorPage.goto('/sessions')
    await expect(instructorPage.getByText('Идёт').first()).toBeVisible({ timeout: 60000 })

    const operator = await browser.newContext()
    const opPage = await operator.newPage()
    await loginAsOperatorLive(opPage)
    await opPage.goto(`/sessions/${session.id}/exam`)
    await expect(opPage.getByText('Квалификационный экзамен')).toBeVisible({ timeout: 20000 })
    await expect(opPage.getByText('ИИ-ассистент', { exact: true })).toHaveCount(0)

    await finishExamViaUi(opPage)
    await expect
      .poll(() => new URL(opPage.url()).pathname, { timeout: 30000 })
      .not.toMatch(/\/exam$/)

    await instructor.close()
    await operator.close()
  })
})
