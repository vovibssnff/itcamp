import { test, expect } from '@playwright/test'
import {
  apiCreateSession,
  apiFindOperatorId,
  apiSeedStack,
  apiSessionAction,
  createAndOpenSession,
  finishExamViaUi,
  loginAsInstructorLive,
  loginAsOperatorLive,
  startSessionFromList,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/**
 * SRD TEST-10 — thin orchestration epic:
 * seed import → train → observe → exam → report (helpers; one serial path).
 */
test.describe('SRD TEST-10 demo path (live)', () => {
  test('import → train fault → observe → exam → report', async ({ browser }) => {
    test.setTimeout(240_000)

    const train = await apiSeedStack({
      scenarioName: `E2E Demo Train ${Date.now().toString(36)}`,
      atModelTime: 30,
      mode: 'training',
      start: false,
    })
    const instructor = await browser.newContext()
    const iPage = await instructor.newPage()
    await loginAsInstructorLive(iPage)
    const trainId = await createAndOpenSession(iPage, {
      token: train.token,
      templateId: train.templateId,
      scenarioId: train.scenarioId,
    })
    await startSessionFromList(iPage, trainId)

    const operator = await browser.newContext()
    const oPage = await operator.newPage()
    await loginAsOperatorLive(oPage)
    await oPage.goto(`/sessions/${trainId}/operator`)
    if (
      await oPage
        .getByTestId('training-start')
        .isVisible({ timeout: 5000 })
        .catch(() => false)
    ) {
      await oPage.getByTestId('training-start').click()
    }

    await iPage.goto(`/sessions/${trainId}/observe`)
    await expect(iPage.getByTestId('session-observe')).toBeVisible({ timeout: 20000 })

    try {
      await apiSessionAction(train.token, trainId, 'stop')
    } catch {
      /* ignore */
    }

    const exam = await apiSeedStack({
      scenarioName: `E2E Demo Exam ${Date.now().toString(36)}`,
      atModelTime: 300,
      mode: 'exam',
      start: false,
    })
    const operatorId = await apiFindOperatorId(exam.token)
    const examSession = await apiCreateSession(exam.token, {
      templateId: exam.templateId,
      scenarioId: exam.scenarioId,
      operatorId,
      mode: 'exam',
    })
    await apiSessionAction(exam.token, examSession.id, 'start')

    await oPage.goto(`/sessions/${examSession.id}/exam`)
    await expect(oPage.getByText('Квалификационный экзамен')).toBeVisible({ timeout: 20000 })
    await finishExamViaUi(oPage)

    try {
      await apiSessionAction(exam.token, examSession.id, 'stop')
    } catch {
      /* ignore */
    }

    await iPage.goto('/sessions')
    const examRow = iPage.locator(`tr[data-row-key="${examSession.id}"]`)
    await expect(examRow).toBeVisible({ timeout: 15000 })
    await examRow.locator('button:has(.anticon-file-text)').click()
    await expect(iPage.getByText(/Отчёт поставлен в очередь/i)).toBeVisible({ timeout: 20000 })
    await iPage.waitForURL(/\/reports\//, { timeout: 30000 })

    await instructor.close()
    await operator.close()
  })
})
