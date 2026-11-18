import { test, expect, type Locator } from '@playwright/test'
import { revealEngravingMarkers } from './helpers/interaction'

async function expectClearSubject(card: Locator) {
  await expect(card).toBeVisible()
  await expect
    .poll(async () =>
      card.evaluate((element) => {
        const subject = JSON.parse((element as HTMLElement).dataset.subject ?? 'null')
        const box = element.getBoundingClientRect()
        const header = document.querySelector('.gallery-header')!.getBoundingClientRect()
        const footer = document.querySelector('.gallery-bottom')!.getBoundingClientRect()
        const overlap = subject
          ? Math.max(
              0,
              Math.min(box.right, subject.x + subject.width) - Math.max(box.left, subject.x),
            ) *
            Math.max(
              0,
              Math.min(box.bottom, subject.y + subject.height) - Math.max(box.top, subject.y),
            )
          : 0
        // Projection and card placement settle after the renderer handles a resize.
        return {
          clearSubject: overlap < 0.5,
          insideViewport:
            box.left >= 11 &&
            box.top >= 0 &&
            box.right <= innerWidth - 10 &&
            box.bottom <= innerHeight,
          clearHeader: box.top >= header.bottom,
          clearFooter: box.bottom <= footer.top,
        }
      }),
    )
    .toEqual({ clearSubject: true, insideViewport: true, clearHeader: true, clearFooter: true })
}

test('zoom controls reach 128x on both faces without the texture shortcut', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Inspect surface texture' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Use raking light' }).click()
  for (const face of ['Cover', 'Record']) {
    await page.getByRole('switch', { name: 'Show record' }).setChecked(face === 'Record')
    await expect(page.getByRole('button', { name: 'Use studio light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.mouse.move(1200, 650)
    await expect(page.locator('.annotation-card')).toHaveCount(0)
    for (let i = 0; i < 22; i++)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Zoom 12800%')
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled()
    await page.mouse.move(1100, 700)
    await page.mouse.down({ button: 'right' })
    await page.mouse.move(1000, 650, { steps: 8 })
    await page.mouse.up({ button: 'right' })
    await expect(page.locator('canvas')).toBeVisible()
    await page.getByRole('button', { name: 'Reset view' }).click()
    await expect(page.getByRole('status')).toContainText('Zoom 100%')
  }
  expect(errors).toEqual([])
})

test('all diagram cards and the music card avoid their projected subject', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
  for (const id of [
    'playback',
    'stylus',
    'signal',
    'scan',
    'raster',
    'calibration',
    'pulsars',
    'hydrogen',
  ]) {
    const marker = page.locator(`[data-inscription="${id}"] .annotation-dot`)
    await marker.focus()
    await expectClearSubject(page.locator(`[data-inscription="${id}"] .annotation-card`))
    await page.keyboard.press('Escape')
  }
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await page.getByRole('button', { name: 'Explore the Sounds of Earth', exact: true }).focus()
  await expectClearSubject(page.locator('.music-info-card'))
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Explore the Sounds of Earth', exact: true }).hover()
  await expectClearSubject(page.locator('.music-info-card'))
})

test('macro callouts reserve a reading rail and restore the inspected view after dismissal', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await revealEngravingMarkers(page)
  await page
    .getByRole('button', { name: 'Explore hydrogen transition', exact: true })
    .hover({ timeout: 60_000 })
  await page.getByRole('button', { name: 'See it close up', exact: true }).click()
  const marker = page.getByRole('button', { name: 'Explore hydrogen transition', exact: true })
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await marker.focus()
    const card = page.locator('[data-inscription="hydrogen"] .annotation-card')
    await expect(card).toHaveAttribute(
      'data-placement',
      viewport.width > 700 ? 'rail-right' : 'rail-bottom',
    )
    await expectClearSubject(card)
    await expect(page.getByRole('status')).toContainText('Zoom 1800%')
    await page.keyboard.press('Escape')
    await expect(page.locator('#artifact')).not.toHaveAttribute('data-callout-dock')
    await expect(card).toHaveCount(0)
    await expect
      .poll(async () => {
        const canvas = (await page.locator('canvas').boundingBox())!
        return Math.abs(canvas.width - viewport.width) + Math.abs(canvas.height - viewport.height)
      })
      .toBeLessThan(2)
    await expect(page.getByRole('status')).toContainText('Zoom 1800%')
    await page.keyboard.press('Tab')
  }
})
