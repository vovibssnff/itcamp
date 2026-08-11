import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import {
  createSessionViaUi,
  fixturesDir,
  joinOperatorTraining,
  loginAsInstructorLive,
  loginAsOperatorLive,
  searchListFor,
  setSessionSpeedViaUi,
  SIM_FAULTS,
  startSessionFromList,
  stopSessionViaUi,
  uploadJson,
  waitForAlarm,
  writeBoundScenarioFixture,
  writeBoundTemplateFixture,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/**
 * FR-AV — K-1 pressure high. Fixture ramp_seconds=30 + 10× speed → alarm
 * within ~15–30s wall time. IA / other faults often never hit H/L limits.
 */
const CASES = [
  { id: 'FR-AV-01', name: 'K-1 pressure high', faultId: SIM_FAULTS.k1PressureHigh },
] as const

const TRIGGER_AT = 8

test.describe('SRD FR-AV parameterized faults (live)', () => {
  let templateId = ''
  let templateName = ''

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginAsInstructorLive(page)

    const fx = fixturesDir()
    await page.goto('/components')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт библиотеки', join(fx, 'components.min.json'))
    await expect(page.getByText(/Импорт:/i)).toBeVisible({ timeout: 15000 })

    await page.goto('/scenarios')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт неисправностей', join(fx, 'faults.min.json'))
    await expect(page.getByText(/Неисправности:/i)).toBeVisible({ timeout: 15000 })

    const tpl = writeBoundTemplateFixture()
    await page.goto('/templates')
    await page.waitForLoadState('networkidle')
    await uploadJson(page, 'Импорт установки', tpl.path)
    await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })
    templateId = page.url().match(/\/templates\/([^/]+)\/edit/)?.[1] ?? ''
    templateName = tpl.name
    expect(templateId).toBeTruthy()
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Проверить' }).click()
    await expect(page.getByText('Граф валиден')).toBeVisible({ timeout: 15000 })
    await ctx.close()
  })

  for (const c of CASES) {
    test(`${c.id}: ${c.name} fault fires — alarm appears in operator HMI`, async ({ browser }) => {
      test.setTimeout(180_000)

      const instructor = await browser.newContext()
      const page = await instructor.newPage()
      await loginAsInstructorLive(page)

      const sc = writeBoundScenarioFixture(templateId, {
        name: `E2E ${c.id} ${Date.now().toString(36)}`,
        atModelTime: TRIGGER_AT,
        faultId: c.faultId,
      })
      await page.goto('/scenarios')
      await page.waitForLoadState('networkidle')
      await uploadJson(page, 'Импорт сценариев', sc.path)
      await expect(page.getByText(/Сценарии:/i)).toBeVisible({ timeout: 15000 })
      await searchListFor(page, sc.name)

      const sessionId = await createSessionViaUi(page, {
        templateName,
        scenarioName: sc.name,
      })
      await startSessionFromList(page, sessionId)
      await setSessionSpeedViaUi(page, sessionId, 10)

      const operator = await browser.newContext()
      const opPage = await operator.newPage()
      await loginAsOperatorLive(opPage)
      await joinOperatorTraining(opPage, sessionId)

      await waitForAlarm(opPage, { timeout: 90_000 })

      await stopSessionViaUi(page, sessionId)
      await operator.close()
      await instructor.close()
    })
  }
})
