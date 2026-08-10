import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

async function openEditableTemplate(page: Page) {
  await page.goto('/templates')
  await page.getByRole('button', { name: 'Новый шаблон' }).click()
  await page.getByPlaceholder('ЭЛОУ-АВТ №1').fill('Test Template E2E')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page).toHaveURL(/\/templates\/.+\/edit/)
}

test.describe('TEST-02: Constructor canvas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'instructor')
  })

  test('can navigate to templates list', async ({ page }) => {
    await page.goto('/templates')
    await expect(page.getByText('Шаблоны установок')).toBeVisible()
  })

  test('shows demo template in list', async ({ page }) => {
    await page.goto('/templates')
    await expect(page.getByText('ЭЛОУ-АВТ демо')).toBeVisible()
  })

  test('can create a new template', async ({ page }) => {
    await openEditableTemplate(page)
  })

  test('reference ЭЛОУ-АВТ template is read-only mnemonic', async ({ page }) => {
    await page.goto('/templates/tmpl-elou-avt/edit')
    await expect(page.getByText('ЭЛОУ-АВТ демо')).toBeVisible()
    await expect(page.getByText(/Эталонная мнемосхема установки/)).toBeVisible()
    await expect(page.locator('svg').first()).toBeVisible()
    await expect(page.getByText('Палитра компонентов')).toHaveCount(0)
  })

  test('constructor screen shows palette and canvas', async ({ page }) => {
    await openEditableTemplate(page)
    await expect(page.getByText('Палитра компонентов')).toBeVisible()
    await expect(page.getByText('Test Template E2E')).toBeVisible()
  })

  test('constructor shows toolbar buttons', async ({ page }) => {
    await openEditableTemplate(page)
    await expect(page.getByRole('button', { name: 'Проверить' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeVisible()
  })

  test('can search components in palette', async ({ page }) => {
    await openEditableTemplate(page)
    await page.getByPlaceholder('Поиск компонентов...').fill('насос')
    await expect(page.getByText('Насос центробежный')).toBeVisible()
  })

  test('can filter palette by category', async ({ page }) => {
    await openEditableTemplate(page)
    await page.getByText('ЭЛОУ').first().click()
    await expect(page.getByText('Электродесольватор')).toBeVisible()
  })
})
