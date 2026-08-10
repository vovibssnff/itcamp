import { test, expect } from '@playwright/test'
import {
  apiGetSession,
  apiListSnapshots,
  apiSeedStack,
  apiSessionAction,
  createAndOpenSession,
  loginAsInstructorLive,
  startSessionFromList,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-09 — checkpoint → restore. */
test.describe('SRD TEST-09 snapshot (live)', () => {
  test('running session → checkpoint → restore → still running', async ({ page }) => {
    test.setTimeout(180_000)
    const seed = await apiSeedStack({
      scenarioName: `E2E Snap ${Date.now().toString(36)}`,
      atModelTime: 300,
      start: false,
    })

    await loginAsInstructorLive(page)
    const sessionId = await createAndOpenSession(page, {
      token: seed.token,
      templateId: seed.templateId,
      scenarioId: seed.scenarioId,
    })
    await startSessionFromList(page, sessionId)

    const row = page.locator(`tr[data-row-key="${sessionId}"]`)
    const snapshotName = `snap-${Date.now()}`
    await row.locator('button:has(.anticon-camera)').click()
    await expect(page.getByRole('dialog').getByText('Сохранить снимок')).toBeVisible()
    await page.getByPlaceholder('Название снимка').fill(snapshotName)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('Снимок сохранён')).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('dialog').getByText('Сохранить снимок')).toHaveCount(0)

    // Snapshot metadata must be persisted, not just reported by the toast.
    await expect
      .poll(async () => (await apiListSnapshots(seed.token, sessionId)).map((s) => s.name), {
        timeout: 20_000,
      })
      .toContain(snapshotName)

    await row.locator('button:has(.anticon-rollback)').click()
    await expect(page.getByRole('dialog').getByText('Восстановить из снимка')).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('dialog').locator('.ant-select').first().click()
    const opt = page.locator('.ant-select-dropdown:visible .ant-select-item-option').first()
    await expect(opt).toBeVisible({ timeout: 15000 })
    await opt.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Восстановить' }).click()
    await expect(page.getByText('Сессия восстановлена из снимка')).toBeVisible({ timeout: 20000 })

    // Restore must not kill the session — it keeps running from the snapshot.
    expect((await apiGetSession(seed.token, sessionId)).status).toBe('running')

    await apiSessionAction(seed.token, sessionId, 'stop').catch(() => undefined)
  })
})
