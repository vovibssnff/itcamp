import { expect, type Page } from '@playwright/test'

export async function uploadJson(page: Page, buttonName: RegExp | string, filePath: string) {
  const btn = page.getByRole('button', { name: buttonName })
  await expect(btn).toBeVisible({ timeout: 15000 })
  // JsonImportButton renders <input type="file"> as an immediately preceding sibling.
  const bound = btn.locator('xpath=preceding-sibling::input[@type="file"][1]')
  if (await bound.count()) {
    await bound.setInputFiles(filePath)
    return
  }
  // Last-resort: first file input on the page (for pages with a single import button).
  await page.locator('input[type="file"]').first().setInputFiles(filePath)
}

export async function pickSelectOption(page: Page, label: string, option: string | RegExp) {
  const formItem = page.locator('.ant-form-item').filter({ hasText: label }).first()
  const select = formItem.locator('.ant-select').first()
  await select.click()
  const search = page.locator('.ant-select-dropdown:visible input').first()
  if (await search.isVisible().catch(() => false)) {
    const q = typeof option === 'string' ? option : option.source.replace(/^\^|\$$/g, '')
    await search.fill(q.slice(0, 40))
  }
  const opt = page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: option })
    .first()
  await expect(opt).toBeVisible({ timeout: 20000 })
  await opt.click()
}

export async function createSessionViaUi(
  page: Page,
  opts: {
    templateName: string
    scenarioName: string
    mode?: 'training' | 'exam'
  },
): Promise<string> {
  await page.goto('/sessions')
  await page.getByRole('button', { name: /Новая сессия/ }).click()
  await expect(page.getByRole('dialog').getByText('Новая сессия')).toBeVisible()

  await pickSelectOption(page, 'Шаблон', opts.templateName)
  await page.waitForTimeout(800)
  await pickSelectOption(page, 'Сценарий', opts.scenarioName)
  if (opts.mode === 'exam') {
    await pickSelectOption(page, 'Режим', 'Экзамен')
  }
  await pickSelectOption(page, 'Оператор', /operator/i)
  await page.getByRole('button', { name: 'Создать' }).click()
  await page.waitForURL(/\/sessions\/[^/]+\/observe/, { timeout: 20000 })
  const id = page.url().match(/\/sessions\/([^/]+)\/observe/)?.[1]
  if (!id) throw new Error('session id not found after create')
  return id
}

/** Prefer API create when IDs are known (avoids ambiguous Ant Select labels). */
export async function createAndOpenSession(
  page: Page,
  opts: {
    token: string
    templateId: string
    scenarioId: string
    mode?: 'training' | 'exam'
  },
): Promise<string> {
  const { apiCreateSession, apiFindOperatorId } = await import('./api')
  const operatorId = await apiFindOperatorId(opts.token)
  const session = await apiCreateSession(opts.token, {
    templateId: opts.templateId,
    scenarioId: opts.scenarioId,
    operatorId,
    mode: opts.mode ?? 'training',
  })
  await page.goto(`/sessions/${session.id}/observe`)
  await expect(page.getByTestId('session-observe')).toBeVisible({ timeout: 20000 })
  // Wait for the auth bootstrap (refresh token exchange + /me) to finish before
  // the caller navigates away. Without this, a concurrent page.goto() can abort
  // the in-flight refresh fetch: the server consumes the old token but the client
  // never receives the replacement, so the next page starts with an invalid token
  // and is immediately redirected to /login.
  await page.waitForLoadState('networkidle')
  return session.id
}

/**
 * Navigate to /sessions, find the specific session row by its Ant Design
 * `data-row-key` attribute, click the start button inside it, and wait for
 * the status tag to read "Идёт". Using data-row-key avoids clicking the wrong
 * row when sessions accumulate across runs.
 */
export async function startSessionFromList(page: Page, sessionId: string) {
  await page.goto('/sessions')
  const row = page.locator(`tr[data-row-key="${sessionId}"]`)
  await expect(row).toBeVisible({ timeout: 15000 })
  const startBtn = row.getByTestId('session-start')
  if (await startBtn.count()) {
    await startBtn.click()
  } else {
    await row.locator('button:has(.anticon-play-circle)').click()
  }
  await expect(row.getByText('Идёт')).toBeVisible({ timeout: 60000 })
}

export async function expectRedirectAwayFrom(page: Page, blockedPath: string) {
  await page.goto(blockedPath)
  await page.waitForTimeout(1500)
  const path = new URL(page.url()).pathname
  expect(path === blockedPath || path.startsWith(blockedPath + '/')).toBeFalsy()
}
