import { test, expect } from '@playwright/test'
import {
  finishExamViaUi,
  joinOperatorTraining,
  loginAsInstructorLive,
  loginAsOperatorLive,
  startSessionFromList,
  stopSessionViaUi,
  uiSeedStack,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/**
 * SRD TEST-10 — thin orchestration epic (UI only):
 * seed import → train → observe → exam → report.
 */
test.describe('SRD TEST-10 demo path (live)', () => {
  test('import → train fault → observe → exam → report', async ({ browser }) => {
    test.setTimeout(300_000)

    const instructor = await browser.newContext()
    const iPage = await instructor.newPage()
    await loginAsInstructorLive(iPage)

    const train = await uiSeedStack(iPage, {
      scenarioName: `E2E Demo Train ${Date.now().toString(36)}`,
      atModelTime: 30,
      mode: 'training',
      start: false,
    })
    await startSessionFromList(iPage, train.sessionId)

    const operator = await browser.newContext()
    const oPage = await operator.newPage()
    await loginAsOperatorLive(oPage)
    await joinOperatorTraining(oPage, train.sessionId)

    await iPage.goto(`/sessions/${train.sessionId}/observe`)
    await expect(iPage.getByTestId('session-observe')).toBeVisible({ timeout: 20000 })
    await stopSessionViaUi(iPage, train.sessionId)

    const exam = await uiSeedStack(iPage, {
      scenarioName: `E2E Demo Exam ${Date.now().toString(36)}`,
      atModelTime: 300,
      mode: 'exam',
      start: false,
    })
    await startSessionFromList(iPage, exam.sessionId)

    await oPage.goto(`/sessions/${exam.sessionId}/exam`)
    await expect(oPage.getByText('Квалификационный экзамен')).toBeVisible({ timeout: 20000 })
    await finishExamViaUi(oPage)

    await iPage.goto('/sessions')
    await iPage.waitForLoadState('networkidle')
    const examRow = iPage.locator(`tr[data-row-key="${exam.sessionId}"]`)
    await expect(examRow).toBeVisible({ timeout: 15000 })
    await expect(examRow.getByText(/Остановлена|Завершена/)).toBeVisible({ timeout: 60000 })
    await expect(examRow.getByTestId('session-score')).toBeVisible({ timeout: 30000 })
    await examRow.locator('button:has(.anticon-file-text)').click()
    await expect(iPage.getByText(/Отчёт поставлен в очередь/i)).toBeVisible({ timeout: 20000 })
    await iPage.waitForURL(/\/reports\//, { timeout: 30000 })

    await instructor.close()
    await operator.close()
  })
})
