import { expect, test } from '@playwright/test'
import { coverProjection, cuts } from './helpers/engravings'
import { inscriptions } from '../../src/lib/inscriptions'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 })
})

for (const mode of ['Orbit', 'Drag']) {
  test(`engraving taps open on the first attempt after zooming out in ${mode} mode`, async ({
    page,
  }) => {
    await page.getByRole('button', { name: mode, exact: true }).tap()
    for (const zoomedOut of [false, true]) {
      if (zoomedOut) {
        await page.getByRole('button', { name: 'Zoom in', exact: true }).tap()
        for (let i = 0; i < 3; i++)
          await page.getByRole('button', { name: 'Zoom out', exact: true }).tap()
        await expect(page.getByRole('status')).toContainText('Zoom 70%')
        // At minimum zoom the introductory DOM markers can overlap nearby cuts.
        // Exercise the material itself once that introduction has faded.
        await expect(page.locator('.annotation-dot').first()).toHaveCSS('opacity', '0')
      }
      for (const cut of cuts) {
        const project = await coverProjection(page)
        const point = project(cut.point)
        await page.touchscreen.tap(point.x, point.y)
        await expect(page.getByRole('dialog')).toBeVisible()
        await expect(page.locator('.detail-category')).toContainText(
          inscriptions.find((item) => item.id === cut.id)!.category,
          { ignoreCase: true },
        )
        await page.getByRole('button', { name: 'Close information' }).tap()
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
    }
  })

  test(`pinch zoom-out and cancelled touches preserve the next tap in ${mode} mode`, async ({
    page,
  }) => {
    await page.getByRole('button', { name: mode, exact: true }).tap()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).tap()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).tap()
    const session = await page.context().newCDPSession(page)
    try {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { x: 120, y: 500, id: 0 },
          { x: 260, y: 500, id: 1 },
        ],
      })
      for (let step = 1; step <= 10; step++)
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: 120 + step * 5, y: 500, id: 0 },
            { x: 260 - step * 5, y: 500, id: 1 },
          ],
        })
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await expect(page.getByRole('status')).toContainText('Zoom 70%')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.locator('.annotation-dot').first()).toHaveCSS('opacity', '0')
      const project = await coverProjection(page)
      const point = project(cuts.find((cut) => cut.id === 'playback')!.point)
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
      await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.touchscreen.tap(point.x, point.y)
      await expect(page.getByRole('dialog')).toContainText('How to play a world')
      await expect(page.locator('.annotation-card')).toHaveCount(0)
      await expect(page.locator('#artifact')).not.toHaveAttribute('data-callout-dock')
    } finally {
      await session.detach()
    }
  })
}

test('touching engraving and music markers opens details without a hover preview', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Zoom in', exact: true }).tap()
  await page.getByRole('button', { name: 'Reset view', exact: true }).tap()
  await page.getByRole('button', { name: 'Explore video waveform', exact: true }).tap()
  await expect(page.locator('.detail-category')).toHaveText('Video waveform')
  await expect(page.locator('.annotation-card')).toHaveCount(0)
  await expect(page.locator('#artifact')).not.toHaveAttribute('data-callout-dock')
  await page.getByRole('button', { name: 'Close information' }).tap()
  await page.getByRole('switch', { name: 'Show record' }).tap()
  await page.getByRole('button', { name: 'Explore the Sounds of Earth', exact: true }).tap()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('The Sounds of Earth')
  await expect(page.locator('.annotation-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close playlist', exact: true }).tap()
  const marker = (await page.locator('.record-music-dot').boundingBox())!
  const point = { x: marker.x + marker.width / 2 + 20, y: marker.y + marker.height / 2 + 24 }
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName, point)).toBe(
    'CANVAS',
  )
  await page.touchscreen.tap(point.x, point.y)
  await expect(page.getByRole('dialog')).toHaveAccessibleName('The Sounds of Earth')
})

test('a first engraving tap works after zoom-out with normal camera motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.getByRole('button', { name: 'Zoom in', exact: true }).tap()
  await page.getByRole('button', { name: 'Zoom out', exact: true }).tap()
  const project = await coverProjection(page)
  const point = project(cuts.find((cut) => cut.id === 'playback')!.point)
  await page.touchscreen.tap(point.x, point.y)
  await expect(page.locator('.detail-category')).toHaveText('Record & rotation')
  await expect(page.locator('.annotation-card')).toHaveCount(0)
})

test('multiple fingers and a drag returning to its start never count as an engraving tap', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Drag', exact: true }).tap()
  const project = await coverProjection(page)
  const point = project(cuts.find((cut) => cut.id === 'playback')!.point)
  const session = await page.context().newCDPSession(page)
  try {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { ...point, id: 0 },
        { x: 40, y: 600, id: 1 },
      ],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    for (const offset of [8, 16, 24, 16, 8, 0])
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: point.x + offset, y: point.y }],
      })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('.annotation-card')).toHaveCount(0)
  } finally {
    await session.detach()
  }
})
