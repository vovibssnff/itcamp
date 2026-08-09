import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

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
    await page.goto('/templates')
    await page.getByRole('button', { name: 'Новый шаблон' }).click()
    await page.getByPlaceholder('ЭЛОУ-АВТ №1').fill('Test Template E2E')
    await page.getByRole('button', { name: 'Создать' }).click()
    // Should redirect to constructor screen
    await expect(page).toHaveURL(/\/templates\/.+\/edit/)
  })

  test('constructor screen shows palette and canvas', async ({ page }) => {
    await page.goto('/templates/tmpl-elou-avt/edit')
    await expect(page.getByText('Палитра компонентов')).toBeVisible()
    await expect(page.getByText('ЭЛОУ-АВТ демо')).toBeVisible()
  })

  test('constructor shows toolbar buttons', async ({ page }) => {
    await page.goto('/templates/tmpl-elou-avt/edit')
    await expect(page.getByRole('button', { name: 'Проверить' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeVisible()
  })

  test('can search components in palette', async ({ page }) => {
    await page.goto('/templates/tmpl-elou-avt/edit')
    await page.getByPlaceholder('Поиск компонентов...').fill('насос')
    await expect(page.getByText('Насос центробежный')).toBeVisible()
  })

  test('can filter palette by category', async ({ page }) => {
    await page.goto('/templates/tmpl-elou-avt/edit')
    await page.getByText('ЭЛОУ').first().click()
    await expect(page.getByText('Электродесольватор')).toBeVisible()
  })
})
