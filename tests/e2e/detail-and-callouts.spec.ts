import { test, expect, type Locator } from '@playwright/test'

async function expectClearSubject(card: Locator) {
  await expect(card).toBeVisible()
  await expect
    .poll(async () =>
      card.evaluate((element) => {
        const subject = JSON.parse((element as HTMLElement).dataset.subject ?? 'null')
        if (!subject) return 0
        const box = element.getBoundingClientRect()
        return (
          Math.max(
            0,
            Math.min(box.right, subject.x + subject.width) - Math.max(box.left, subject.x),
          ) *
          Math.max(
            0,
            Math.min(box.bottom, subject.y + subject.height) - Math.max(box.top, subject.y),
          )
        )
      }),
    )
    .toBeLessThan(0.5)
  const box = (await card.boundingBox())!
  const viewport = await card.evaluate(() => ({ width: innerWidth, height: innerHeight }))
  expect(box.x).toBeGreaterThanOrEqual(11)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 10)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  const header = (await card.page().locator('.gallery-header').boundingBox())!
  const footer = (await card.page().locator('.gallery-bottom').boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(header.y + header.height)
  expect(box.y + box.height).toBeLessThanOrEqual(footer.y)
}

test('surface studies resolve at 96x and can zoom through to 128x on both faces', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (const face of ['Cover', 'Record']) {
    await page.getByRole('button', { name: face, exact: true }).click()
    await page.getByRole('button', { name: 'Inspect surface texture', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Zoom 9600%')
    await expect(page.getByRole('button', { name: 'Use studio light' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.mouse.move(1200, 650)
    await expect(page.locator('.annotation-card')).toHaveCount(0)
    for (let i = 0; i < 2; i++)
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
  await page.getByRole('button', { name: 'Record', exact: true }).click()
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
  await page.getByRole('button', { name: 'Show engraving markers' }).click()
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
