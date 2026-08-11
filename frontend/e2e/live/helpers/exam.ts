import { expect, type Page } from '@playwright/test'

/** Open exam finish confirm dialog and confirm. */
export async function finishExamViaUi(page: Page) {
  await page.getByTestId('exam-finish').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.getByRole('button', { name: 'Завершить' }).click()
}
