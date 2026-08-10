import { test, expect } from '@playwright/test'
import { join } from 'node:path'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  ensureOperatorProvisioned,
  fixturesDir,
  loginAsInstructorLive,
  uploadJson,
  writeBoundScenarioFixture,
  createAndOpenSession,
  apiToken,
  startSessionFromList,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** E2E-003 smoke: import library → facility → scenario → create/start session. */
test.describe('SRD E2E-003 import chain (live)', () => {
  test('upload library → facility → faults/scenario → start session', async ({ page }) => {
    test.setTimeout(180_000)
    const fx = fixturesDir()
    await ensureOperatorProvisioned()
    await loginAsInstructorLive(page)

    await page.goto('/components')
    await expect(page.getByRole('button', { name: 'Импорт библиотеки' })).toBeVisible()
    await uploadJson(page, 'Импорт библиотеки', join(fx, 'components.min.json'))
    await expect(page.getByText(/Импорт:/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Центробежный насос').first()).toBeVisible()

    await page.goto('/scenarios')
    await uploadJson(page, 'Импорт неисправностей', join(fx, 'faults.min.json'))
    await expect(page.getByText(/Неисправности:/)).toBeVisible({ timeout: 15000 })

    const facilityName = `E2E Mini Facility ${Date.now().toString(36)}`
    const tplRaw = JSON.parse(readFileSync(join(fx, 'template.min.json'), 'utf8')) as {
      name: string
    }
    tplRaw.name = facilityName
    const tplPath = join(mkdtempSync(join(tmpdir(), 'ktk-e2e-')), 'tpl.json')
    writeFileSync(tplPath, JSON.stringify(tplRaw))

    await page.goto('/templates')
    await uploadJson(page, 'Импорт установки', tplPath)
    await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })
    const templateId = page.url().match(/\/templates\/([^/]+)\/edit/)?.[1]
    expect(templateId).toBeTruthy()

    await page.getByRole('button', { name: 'Проверить' }).click()
    await expect(page.getByText('Граф валиден')).toBeVisible({ timeout: 15000 })

    const scenarioName = `E2E Mini Scenario ${Date.now().toString(36)}`
    const scenarioPath = writeBoundScenarioFixture(templateId!, { name: scenarioName })

    await page.goto('/scenarios')
    await uploadJson(page, 'Импорт сценариев', scenarioPath)
    await expect(page.getByText(/Сценарии:/)).toBeVisible({ timeout: 15000 })
    // The scenarios list may paginate or not auto-refresh; the API lookup below
    // is the authoritative check that the import landed in the DB.

    // Resolve scenario id from list API via token, then create session without ambiguous selects.
    // Use ?q= filter so the result isn't lost if the list is paginated (many accumulated runs).
    const token = await apiToken('instructor')
    const base = process.env.E2E_API_BASE ?? 'http://localhost:8088'
    const list = (await (
      await fetch(`${base}/api/v1/scenarios?q=${encodeURIComponent(scenarioName)}&limit=50`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
    ).json()) as Array<{ id: string; name: string }>
    const sc = list.find((s) => s.name === scenarioName)
    expect(sc).toBeTruthy()

    const sessionId = await createAndOpenSession(page, {
      token,
      templateId: templateId!,
      scenarioId: sc!.id,
      mode: 'training',
    })
    await startSessionFromList(page, sessionId)
  })
})
