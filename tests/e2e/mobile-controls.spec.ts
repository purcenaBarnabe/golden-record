import { expect, test, type CDPSession } from '@playwright/test'

async function swipe(session: CDPSession, fromX: number, toX: number, y: number) {
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: fromX, y }],
  })
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: fromX + ((toX - fromX) * step) / 12, y }],
    })
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('mobile controls fit on one row and keep the mode buttons below the subtitle', async ({
  page,
}) => {
  await page.goto('/')
  const surfaceSwitch = page.getByRole('switch', { name: 'Show record' })
  await expect(surfaceSwitch).toBeEnabled({ timeout: 60_000 })
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('button', { name: 'Inspect surface texture' })).toBeHidden()
    await expect(page.getByRole('button', { name: /Use (raking|studio) light/ })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Drag', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Orbit', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    const modes = (await page.getByRole('group', { name: 'Touch navigation' }).boundingBox())!
    const subtitle = (await page.getByText('Voyager, 1977', { exact: true }).boundingBox())!
    expect(modes.y).toBeGreaterThan(subtitle.y + subtitle.height)
    expect(modes.x).toBe(subtitle.x)
    const toolbar = (await page.getByRole('toolbar').boundingBox())!
    expect(toolbar.x).toBeGreaterThanOrEqual(12)
    expect(toolbar.x + toolbar.width).toBeLessThanOrEqual(viewport.width - 12)
    expect(toolbar.height).toBeLessThan(65)
    for (const label of ['Zoom out', 'Zoom in', 'Reset view', 'Show engraving markers'])
      await expect(page.getByRole('button', { name: label, exact: true })).toBeInViewport()
    await surfaceSwitch.tap()
    await expect(surfaceSwitch).toBeChecked()
    await expect(page.locator('.surface-caption')).toContainText('Side 1')
    await surfaceSwitch.tap()
    await expect(surfaceSwitch).not.toBeChecked()
  }
})

test('mobile starts with one-finger dragging, keeps pinch zoom, and can switch to orbit', async ({
  page,
}) => {
  await page.goto('/')
  const surfaceSwitch = page.getByRole('switch', { name: 'Show record' })
  await expect(surfaceSwitch).toBeEnabled({ timeout: 60_000 })
  const drag = page.getByRole('button', { name: 'Drag', exact: true })
  const orbit = page.getByRole('button', { name: 'Orbit', exact: true })
  const marker = page.locator('[data-inscription="playback"] .annotation-dot')
  const before = (await marker.boundingBox())!
  const session = await page.context().newCDPSession(page)
  try {
    await swipe(session, 300, 180, 500)
    await expect.poll(async () => before.x - (await marker.boundingBox())!.x).toBeGreaterThan(30)
    expect(Math.abs((await marker.boundingBox())!.y - before.y)).toBeLessThan(2)
    await expect(surfaceSwitch).not.toBeChecked()
    await expect(drag).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Reset view' }).tap()
    await expect
      .poll(async () => Math.abs((await marker.boundingBox())!.x - before.x))
      .toBeLessThan(2)

    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 150, y: 500, id: 0 },
        { x: 230, y: 500, id: 1 },
      ],
    })
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: 150 - step * 5, y: 500, id: 0 },
          { x: 230 + step * 5, y: 500, id: 1 },
        ],
      })
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('status')).not.toContainText('Zoom 100%')
    await page.getByRole('button', { name: 'Reset view' }).tap()
    await expect(page.getByRole('status')).toContainText('Zoom 100%')

    await orbit.tap()
    await expect(orbit).toHaveAttribute('aria-pressed', 'true')
    await expect(drag).toHaveAttribute('aria-pressed', 'false')
    for (let gesture = 0; gesture < 3; gesture++) await swipe(session, 330, 50, 500)
    await expect(surfaceSwitch).toBeChecked()
    await expect(page.locator('.surface-caption')).toContainText('Side 1')
    await drag.tap()
    await expect(drag).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(drag).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await session.detach()
  }
})
