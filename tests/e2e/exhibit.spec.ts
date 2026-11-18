import { test, expect } from '@playwright/test'
import { revealEngravingMarkers } from './helpers/interaction'

test('the gallery is a single uncluttered viewport in both themes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Golden Record')
  await expect(
    page.getByRole('navigation', { name: 'Exhibit options' }).getByRole('button'),
  ).toHaveCount(2)
  await expect(
    page.getByRole('button', { name: 'Explore the engravings', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Touch navigation' })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(
    true,
  )
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgb(0, 0, 0)',
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  expect(await page.locator('html').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgb(255, 255, 255)',
  )
  expect(errors).toEqual([])
})

for (const colorScheme of ['light', 'dark'] as const) {
  test(`system ${colorScheme} mode is honored and tracks changes without a saved preference`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
    const opposite = colorScheme === 'dark' ? 'light' : 'dark'
    await expect(page.getByRole('button', { name: `Switch to ${opposite} mode` })).toBeEnabled()
    await page.emulateMedia({ colorScheme: opposite })
    await expect(page.locator('html')).toHaveAttribute('data-theme', opposite)
    await expect(page.locator('.gallery')).toHaveAttribute('data-theme', opposite)
    await page.emulateMedia({ colorScheme })
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme)
  })
}

test('all eight engravings remain keyboard accessible with markers hidden', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.annotation-dot')).toHaveCount(8, { timeout: 60_000 })
  await expect(page.locator('.annotation-dot').first()).toHaveCSS('opacity', '0')
  const categories = [
    'record & rotation',
    'stylus & duration',
    'video waveform',
    'scan & interlace',
    'picture raster',
    'calibration image',
    'pulsar map',
    'hydrogen transition',
  ]
  for (const category of categories) {
    await page.getByRole('button', { name: `Explore ${category}`, exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.locator('.detail-category')).toContainText(category, { ignoreCase: true })
    await page.getByRole('button', { name: 'Close information' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: `Explore ${category}`, exact: true }),
    ).toBeFocused()
  }
})

for (const interaction of ['orbit', 'pan', 'wheel', 'zoom button'] as const) {
  test(`engraving markers briefly fade in after ${interaction}`, async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false', {
      timeout: 60_000,
    })
    const markers = page.locator('.annotation-dot')
    await expect(markers).toHaveCount(8)
    await expect(markers.first()).toHaveCSS('opacity', '0')
    await expect(page.getByRole('button', { name: /engraving markers/ })).toHaveCount(0)
    const icon = markers.first().locator('span')
    await expect(icon).toHaveCSS('border-radius', '50%')
    const box = (await icon.boundingBox())!
    expect(box.width).toBe(box.height)
    await expect(markers.first()).toHaveCSS('transition-duration', '0.45s')

    const interact = async () => {
      if (interaction === 'zoom button') {
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
      } else {
        await page.mouse.move(40, 500)
        if (interaction === 'wheel') await page.mouse.wheel(0, -100)
        else {
          const button = interaction === 'pan' ? 'right' : 'left'
          await page.mouse.down({ button })
          await page.mouse.move(70, 510, { steps: 5 })
          await page.mouse.up({ button })
        }
      }
    }
    await interact()
    for (const marker of await markers.all()) await expect(marker).toHaveCSS('opacity', '1')
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await expect(markers.first()).toHaveCSS('opacity', '1')
    await expect(markers.first()).toHaveCSS('opacity', '0')
    await expect(markers.first()).toHaveCSS('pointer-events', 'none')
    await interact()
    await expect(page.locator('.annotation.show-marker')).toHaveCount(0)
    await expect(markers.first()).toHaveCSS('opacity', '0')
    await page.reload()
    await expect(markers.first()).toHaveCSS('opacity', '0')
    await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false')
    await interact()
    await expect(markers.first()).toHaveCSS('opacity', '1')
  })
}

test('hover cards open explanations and navigate between engravings', async ({ page }) => {
  await page.goto('/')
  await revealEngravingMarkers(page)
  await page
    .getByRole('button', { name: 'Explore hydrogen transition', exact: true })
    .hover({ timeout: 60_000 })
  await expect(page.locator('.annotation-card')).toContainText('A universal measure')
  await page.getByRole('button', { name: 'What does this mean?', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('nanoseconds per time unit')
  await page.getByRole('button', { name: 'Previous engraving' }).click()
  await expect(page.getByRole('dialog')).toContainText('Our return address')
  await page.getByRole('button', { name: 'Next engraving' }).click()
  await expect(page.getByRole('dialog')).toContainText('A universal measure')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('cards stay mounted while the pointer crosses every part of each card', async ({ page }) => {
  await page.goto('/')
  await revealEngravingMarkers(page)
  await expect(page.locator('.annotation-dot')).toHaveCount(8, { timeout: 60_000 })
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
    await page.mouse.move(1200, 800)
    await expect(page.locator('.annotation-card')).toHaveCount(0)
    const marker = page.locator(`[data-inscription="${id}"] .annotation-dot`)
    await marker.focus()
    const origin = (await marker.boundingBox())!
    await page.mouse.move(origin.x + origin.width / 2, origin.y + origin.height / 2)
    await marker.evaluate((element) => element.blur())
    const card = page.locator(`[data-inscription="${id}"] .annotation-card`)
    await expect(card).toBeVisible()
    await card.evaluate((node) => node.setAttribute('data-stability-probe', 'original'))
    const box = (await card.boundingBox())!
    for (const [x, y] of [
      [box.x + 8, box.y + 8],
      [box.x + box.width - 8, box.y + 8],
      [box.x + box.width - 8, box.y + box.height - 8],
      [box.x + 8, box.y + box.height - 8],
    ]) {
      await page.mouse.move(x, y, { steps: 10 })
      await page.waitForTimeout(220)
      await expect(card).toHaveAttribute('data-stability-probe', 'original')
      await expect(page.locator('.annotation-card')).toHaveCount(1)
    }
  }
  await page.mouse.move(1200, 800)
  await expect(page.locator('.annotation-card')).toHaveCount(0)
})

test('carving inspection focuses a diagram and zoom reaches 128 times', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await revealEngravingMarkers(page)
  await page
    .getByRole('button', { name: 'Explore hydrogen transition', exact: true })
    .hover({ timeout: 60_000 })
  await page.getByRole('button', { name: 'See it close up', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Zoom 1800%')
  for (let i = 0; i < 9; i++)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Zoom 12800%')
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Use raking light' }).click()
  await expect(page.getByRole('button', { name: 'Use studio light' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.mouse.move(1100, 780)
  await page.mouse.down()
  await page.mouse.move(1250, 800, { steps: 10 })
  await expect(page.locator('.annotation-card')).toHaveCount(0)
  await page.mouse.up()
  await page.getByRole('button', { name: 'Reset view' }).click()
  await expect(page.getByRole('status')).toContainText('Zoom 100%')
  await page.getByRole('button', { name: 'Explore record & rotation', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toContainText('How to play a world')
  await page.getByRole('button', { name: 'See it close up' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Zoom 1800%')
})

test('surface controls rotate the display to the record and preserve inspection tools', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.annotation-dot')).toHaveCount(8, { timeout: 60_000 })
  await revealEngravingMarkers(page)
  await expect(page.locator('.annotation-dot').first()).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Zoom 125%')
  await page.mouse.move(700, 600)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(750, 620, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  await page.getByRole('button', { name: 'Reset view' }).click()
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await expect(page.locator('.surface-caption')).toContainText('Side 1')
  await expect(page.locator('.annotation-dot').first()).toBeHidden()
  await page.getByRole('switch', { name: 'Show record' }).setChecked(false)
  await expect(page.locator('.annotation-dot').first()).toBeVisible()
  const surfaceSwitch = page.getByRole('switch', { name: 'Show record' })
  await surfaceSwitch.focus()
  await page.keyboard.press('Space')
  await expect(surfaceSwitch).toBeChecked()
  await expect(page.locator('.surface-caption')).toContainText('Side 1')
  await page.keyboard.press('Enter')
  await expect(surfaceSwitch).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Inspect surface texture' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Use raking light' }).click()
  await expect(page.getByRole('button', { name: 'Use studio light' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'About this recreation' }).click()
  await expect(page.getByRole('dialog')).toContainText('1.27 mm')
  await expect(page.getByRole('dialog')).toContainText('separate aluminum protective cover')
})

test('mobile remains one viewport without overflow in light and dark modes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.annotation-dot')).toHaveCount(8, { timeout: 60_000 })
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  ).toBe(true)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await revealEngravingMarkers(page)
  await page.getByRole('button', { name: 'Explore hydrogen transition', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('A universal measure')
})

test('the reference photograph, information and music work without WebGL', async ({ page }) => {
  const assetRequests: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (/cover-relief\.|record-(albedo|roughness|anisotropy|relief)\.webp/.test(path))
      assetRequests.push(path)
  })
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes('webgl')) return null
      return original.apply(this, [type, ...args] as Parameters<typeof original>)
    } as typeof original
  })
  await page.goto('/')
  await expect(page.getByText('3D is unavailable in this browser.', { exact: false })).toBeVisible()
  await expect(page.getByText('Preparing the record')).toHaveCount(0)
  await expect(
    page.getByRole('img', { name: 'NASA reference photograph of the Golden Record cover' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'About this recreation' }).click()
  await expect(page.getByRole('dialog')).toContainText('1.27 mm')
  await page.getByRole('button', { name: 'Close information' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await page.locator('.listen-caption').click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('The Sounds of Earth')
  await expect(page.locator('.music-track')).toHaveCount(27)
  expect(assetRequests).toEqual([])
})
