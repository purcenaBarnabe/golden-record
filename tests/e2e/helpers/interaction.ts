import { expect, type Page } from '@playwright/test'

export async function revealEngravingMarkers(page: Page) {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(page.locator('.annotation-dot').first()).toHaveCSS('opacity', '1')
}
