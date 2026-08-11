import { expect, type Page } from '@playwright/test'
import { join } from 'node:path'
import { ensureOperatorProvisioned } from './auth'
import { writeBoundScenarioFixture, writeBoundTemplateFixture } from './fixtures'
import { fixturesDir } from './paths'

/** Type into the scenarios/templates list search box and wait for the row. */
export async function searchListFor(page: Page, name: string) {
  const search = page.getByPlaceholder('Поиск...')
  if (await search.count()) {
    await search.fill(name)
    await page.waitForLoadState('networkidle')
  }
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 })
}

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
  await ensureOperatorProvisioned()
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Новая сессия/ }).click()
  await expect(page.getByRole('dialog').getByText('Новая сессия')).toBeVisible()

  await pickSelectOption(page, 'Шаблон', opts.templateName)
  // Scenario options load after template selection (filtered by template_id).
  const scenarioSelect = page
    .locator('.ant-form-item')
    .filter({ hasText: 'Сценарий' })
    .locator('.ant-select')
    .first()
  await expect(scenarioSelect).not.toHaveClass(/ant-select-disabled/, { timeout: 20000 })
  await pickSelectOption(page, 'Сценарий', opts.scenarioName)
  if (opts.mode === 'exam') {
    await pickSelectOption(page, 'Режим', 'Экзамен')
  }
  await pickSelectOption(page, 'Оператор', /operator/i)
  await page.getByRole('button', { name: 'Создать' }).click()
  await page.waitForURL(/\/sessions\/[^/]+\/observe/, { timeout: 20000 })
  const id = page.url().match(/\/sessions\/([^/]+)\/observe/)?.[1]
  if (!id) throw new Error('session id not found after create')
  await page.waitForLoadState('networkidle')
  return id
}

/**
 * Navigate to /sessions, find the specific session row by its Ant Design
 * `data-row-key` attribute, click the start button inside it, and wait for
 * the status tag to read "Идёт".
 */
export async function startSessionFromList(page: Page, sessionId: string) {
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')
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

/** Set session sim speed via the InstructorConsole row Select (1×…10×). */
export async function setSessionSpeedViaUi(page: Page, sessionId: string, speed: number) {
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')
  const row = page.locator(`tr[data-row-key="${sessionId}"]`)
  await expect(row).toBeVisible({ timeout: 15000 })
  const select = row.locator('.ant-select').first()
  await select.click()
  const opt = page
    .locator('.ant-select-dropdown:visible .ant-select-item-option')
    .filter({ hasText: new RegExp(`^${speed}×$`) })
    .first()
  await expect(opt).toBeVisible({ timeout: 10000 })
  await opt.click()
  await expect(select).toContainText(`${speed}×`, { timeout: 10000 })
}

export async function stopSessionViaUi(page: Page, sessionId: string) {
  await page.goto('/sessions')
  await page.waitForLoadState('networkidle')
  const row = page.locator(`tr[data-row-key="${sessionId}"]`)
  await expect(row).toBeVisible({ timeout: 15000 })
  const stopBtn = row.locator('button:has(.anticon-stop)')
  if (await stopBtn.isVisible().catch(() => false)) {
    await stopBtn.click()
    await expect(row.getByText(/Остановлена|Завершена/)).toBeVisible({ timeout: 30000 })
  }
}

/** Operator joins a (possibly already-running) session and enables the WS feed. */
export async function joinOperatorTraining(page: Page, sessionId: string) {
  await page.goto(`/sessions/${sessionId}/operator`)
  await page.waitForLoadState('networkidle')
  const start = page.getByTestId('training-start')
  await expect(start).toBeVisible({ timeout: 15000 })
  await start.click()
  await expect(start).toHaveCount(0, { timeout: 15000 })
  // Either connected immediately, or reconnecting after origin/auth handshake.
  await expect(page.getByText(/ПОДКЛЮЧЕНО|ОЖИДАНИЕ/)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('ПОДКЛЮЧЕНО')).toBeVisible({ timeout: 30000 })
}

export async function waitForAlarm(page: Page, { timeout = 120_000 } = {}) {
  await expect(page.getByTestId('alarm-banner')).toBeVisible({ timeout })
  await expect(page.getByTestId('alarm-count')).not.toHaveText('0', { timeout: 5_000 })
}

/**
 * Full UI data seed: imports components, faults, template, scenario via browser
 * file upload and creates a session via the "Новая сессия" form.
 * Caller must already be logged in as instructor.
 */
export async function uiSeedStack(
  page: Page,
  opts?: {
    templateFile?: string
    scenarioName?: string
    atModelTime?: number
    mode?: 'training' | 'exam'
    faultId?: string
    start?: boolean
  },
): Promise<{
  templateName: string
  scenarioName: string
  sessionId: string
}> {
  const fx = fixturesDir()

  await page.goto('/components')
  await page.waitForLoadState('networkidle')
  await uploadJson(page, 'Импорт библиотеки', join(fx, 'components.min.json'))
  await expect(page.getByText(/Импорт:/i)).toBeVisible({ timeout: 15000 })

  await page.goto('/scenarios')
  await page.waitForLoadState('networkidle')
  await uploadJson(page, 'Импорт неисправностей', join(fx, 'faults.min.json'))
  await expect(page.getByText(/Неисправности:/i)).toBeVisible({ timeout: 15000 })

  const tpl = writeBoundTemplateFixture({
    file: opts?.templateFile ?? join(fx, 'template.min.json'),
  })
  await page.goto('/templates')
  await page.waitForLoadState('networkidle')
  await uploadJson(page, 'Импорт установки', tpl.path)
  await page.waitForURL(/\/templates\/[^/]+\/edit/, { timeout: 20000 })
  const templateId = page.url().match(/\/templates\/([^/]+)\/edit/)?.[1]
  if (!templateId) throw new Error('template id not found after import')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Проверить' }).click()
  await expect(page.getByText('Граф валиден')).toBeVisible({ timeout: 15000 })

  const sc = writeBoundScenarioFixture(templateId, {
    name: opts?.scenarioName,
    atModelTime: opts?.atModelTime ?? 15,
    type: opts?.mode === 'exam' ? 'exam' : 'training',
    faultId: opts?.faultId,
  })
  await page.goto('/scenarios')
  await page.waitForLoadState('networkidle')
  await uploadJson(page, 'Импорт сценариев', sc.path)
  await expect(page.getByText(/Сценарии:/i)).toBeVisible({ timeout: 15000 })
  await searchListFor(page, sc.name)

  const sessionId = await createSessionViaUi(page, {
    templateName: tpl.name,
    scenarioName: sc.name,
    mode: opts?.mode ?? 'training',
  })

  if (opts?.start) {
    await startSessionFromList(page, sessionId)
  }

  return {
    templateName: tpl.name,
    scenarioName: sc.name,
    sessionId,
  }
}

export async function expectRedirectAwayFrom(page: Page, blockedPath: string) {
  await page.goto(blockedPath)
  await page.waitForTimeout(1500)
  const path = new URL(page.url()).pathname
  expect(path === blockedPath || path.startsWith(blockedPath + '/')).toBeFalsy()
}
