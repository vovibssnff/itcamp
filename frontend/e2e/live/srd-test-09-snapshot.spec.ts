import { test, expect } from '@playwright/test'
import {
  loginAsInstructorLive,
  startSessionFromList,
  stopSessionViaUi,
  uiSeedStack,
} from './helpers'

test.describe.configure({ mode: 'serial' })

/** SRD TEST-09 — checkpoint → restore via UI. */
test.describe('SRD TEST-09 snapshot (live)', () => {
  test('running session → checkpoint → restore → still running', async ({ page }) => {
    test.setTimeout(180_000)
    await loginAsInstructorLive(page)
    const seed = await uiSeedStack(page, {
      scenarioName: `E2E Snap ${Date.now().toString(36)}`,
      atModelTime: 300,
      start: false,
    })
    await startSessionFromList(page, seed.sessionId)

    const row = page.locator(`tr[data-row-key="${seed.sessionId}"]`)
    const snapshotName = `snap-${Date.now()}`
    await row.locator('button:has(.anticon-camera)').click()
    await expect(page.getByRole('dialog').getByText('Сохранить снимок')).toBeVisible()
    await page.getByPlaceholder('Название снимка').fill(snapshotName)
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await expect(page.getByText('Снимок сохранён')).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('dialog').getByText('Сохранить снимок')).toHaveCount(0)

    // Restore dialog dropdown proves the snapshot was persisted.
    await row.locator('button:has(.anticon-rollback)').click()
    await expect(page.getByRole('dialog').getByText('Восстановить из снимка')).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('dialog').locator('.ant-select').first().click()
    const opt = page
      .locator('.ant-select-dropdown:visible .ant-select-item-option')
      .filter({ hasText: snapshotName })
      .first()
    await expect(opt).toBeVisible({ timeout: 15000 })
    await opt.click()
    await page.getByRole('dialog').getByRole('button', { name: 'Восстановить' }).click()
    await expect(page.getByText('Сессия восстановлена из снимка')).toBeVisible({ timeout: 20000 })

    await expect(row.getByText('Идёт')).toBeVisible({ timeout: 15000 })
    await stopSessionViaUi(page, seed.sessionId)
  })
})
