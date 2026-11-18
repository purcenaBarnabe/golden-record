import { test, expect } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import { ARTIFACT_CENTER_Y, COVER_FACE_Z, COVER_RADIUS } from '../../src/lib/artifact-dimensions'
import { inscriptions } from '../../src/lib/inscriptions'
import { coverProjection, cuts } from './helpers/engravings'

test('a card stays mounted across gaps in the same engraving and its trace ends at the marker', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false', {
      timeout: 60_000,
    })
    const project = await coverProjection(page)
    const entry = project(cuts.find((cut) => cut.id === 'playback')!.point)
    await page.mouse.move(entry.x, entry.y)
    const card = page.locator('[data-inscription="playback"] .annotation-card')
    await expect(card).toBeVisible()
    await card.evaluate((element) => element.setAttribute('data-stability', 'original'))
    const currentProjection = await coverProjection(page)
    for (const uv of [
      [0.39, 0.42],
      [0.37, 0.4],
      [0.35, 0.4],
    ]) {
      const gap = currentProjection(uv)
      await page.mouse.move(gap.x, gap.y, { steps: 5 })
      await page.waitForTimeout(350)
      await expect(card).toHaveAttribute('data-stability', 'original')
    }
    const marker = (await page
      .locator('[data-inscription="playback"] .annotation-dot')
      .boundingBox())!
    const line = page.locator('[data-inscription="playback"] .annotation-connector > path')
    const coordinates = (await line.getAttribute('d'))!.match(/-?[\d.]+/g)!.map(Number)
    expect(Math.abs(coordinates[0] - marker.x - marker.width / 2)).toBeLessThan(1)
    expect(Math.abs(coordinates[1] - marker.y - marker.height / 2)).toBeLessThan(1)
    await page.mouse.move(12, viewport.height - 12)
    await expect(card).toHaveCount(0)
  }
})

test('only the hovered marker stays visible after the introduction and hides when leaving', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false', {
    timeout: 60_000,
  })
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  const marker = page.locator('[data-inscription="hydrogen"] .annotation-dot')
  await marker.hover()
  const card = page.locator('[data-inscription="hydrogen"] .annotation-card')
  await expect(card).toBeVisible()
  await card.evaluate((element) => element.setAttribute('data-stability', 'original'))
  await expect(page.locator('[data-inscription="playback"] .annotation-dot')).toHaveCSS(
    'opacity',
    '0',
  )
  await expect(marker).toHaveCSS('opacity', '1')
  await expect(card).toHaveAttribute('data-stability', 'original')
  await expect(card).toBeVisible()
  await page.mouse.move(12, 950)
  await expect(card).toHaveCount(0)
  await expect(marker).toHaveCSS('opacity', '0')
  const project = await coverProjection(page)
  const entry = project(cuts.find((cut) => cut.id === 'hydrogen')!.point)
  await page.mouse.move(entry.x, entry.y)
  await expect(marker).toHaveCSS('opacity', '1')
  await expect(card).toBeVisible()
  await expect(page.locator('[data-inscription="playback"] .annotation-dot')).toHaveCSS(
    'opacity',
    '0',
  )
})

test('empty metal inside diagram bounds does not activate cards or click targets', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
    await expect(page.locator('.annotation-dot').first()).toHaveCSS('pointer-events', 'none')
    for (const zoomed of [false, true]) {
      if (zoomed) {
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await page.waitForTimeout(100)
      }
      const project = await coverProjection(page)
      // Stay clear of the four-pixel allowance around the small spindle and
      // calibration circles, including at the phone's smaller display scale.
      for (const uv of [
        [0.2, 0.32],
        [0.7, 0.47],
        [0.665, 0.6],
        [0.5, 0.83],
      ]) {
        const point = project(uv)
        await page.mouse.move(point.x, point.y)
        await page.waitForTimeout(80)
        await expect(page.locator('.annotation-card')).toHaveCount(0)
        await page.mouse.click(point.x, point.y)
        await expect(page.getByRole('dialog')).toHaveCount(0)
      }
    }
  }
})

test('each actual engraving opens its card with markers hidden and remains reachable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
    const project = await coverProjection(page)
    const anchor = page.locator('.annotation-dot').first()
    const original = (await anchor.boundingBox())!
    for (const cut of cuts) {
      await page.mouse.move(12, viewport.height - 12)
      await expect(page.locator('.annotation-card')).toHaveCount(0)
      // A reading rail must finish restoring the renderer before using its projection.
      await expect
        .poll(async () => {
          const current = (await anchor.boundingBox())!
          return Math.abs(current.x - original.x) + Math.abs(current.y - original.y)
        })
        .toBeLessThan(1)
      const point = project(cut.point)
      await page.mouse.move(point.x, point.y)
      const card = page.locator(`[data-inscription="${cut.id}"] .annotation-card`)
      await expect(card).toBeVisible()
      await expect(page.locator(`[data-inscription="${cut.id}"] .annotation-dot`)).toHaveCSS(
        'opacity',
        '1',
      )
      await card.evaluate((element) => element.setAttribute('data-stability', 'original'))
      const box = (await card.boundingBox())!
      // A slow approach exceeds the ordinary leave grace period. The safe
      // corridor must start at the hit engraving, not its distant marker.
      for (let step = 1; step <= 15; step++) {
        await page.mouse.move(
          point.x + ((box.x + box.width / 2 - point.x) * step) / 15,
          point.y + ((box.y + box.height / 2 - point.y) * step) / 15,
        )
        await page.waitForTimeout(25)
      }
      await expect(card).toHaveAttribute('data-stability', 'original')
    }
  }
})

test('surface hover stays available in a close diagram view and stops for texture-level zoom', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore hydrogen transition', exact: true }).focus()
  await page.getByRole('button', { name: 'See it close up', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Zoom 1800%')
  const viewport = page.viewportSize()!
  const focus = inscriptions.find((item) => item.id === 'hydrogen')!.point
  const cut = cuts.find((item) => item.id === 'hydrogen')!.point
  // This action has a deterministic camera pose. Project a real cut triangle
  // rather than relying on offscreen/behind-camera marker DOM at macro zoom.
  const projectCut = (zoom: number) => {
    const pivot = new Vector3(
      (focus[0] - 0.5) * COVER_RADIUS * 2,
      (0.5 - focus[1]) * COVER_RADIUS * 2 + ARTIFACT_CENTER_Y,
      COVER_FACE_Z,
    )
    const camera = new PerspectiveCamera(33, viewport.width / viewport.height, 0.00003, 30)
    camera.position
      .set(0.245, 0.18, 1.1)
      .multiplyScalar(Math.max(1, 0.72 / camera.aspect) / zoom)
      .add(pivot)
    camera.lookAt(pivot)
    camera.updateMatrixWorld()
    const point = new Vector3(
      (cut[0] - 0.5) * COVER_RADIUS * 2,
      (0.5 - cut[1]) * COVER_RADIUS * 2 + ARTIFACT_CENTER_Y,
      COVER_FACE_Z - 0.000045,
    ).project(camera)
    return { x: ((point.x + 1) * viewport.width) / 2, y: ((1 - point.y) * viewport.height) / 2 }
  }
  await page.mouse.move(12, viewport.height - 12)
  await page.waitForTimeout(100)
  const close = projectCut(18)
  await page.mouse.move(close.x, close.y)
  await expect(page.locator('[data-inscription="hydrogen"] .annotation-card')).toBeVisible()
  await page.mouse.move(12, viewport.height - 12)
  await expect(page.locator('.annotation-card')).toHaveCount(0)
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.waitForTimeout(100)
  const deep = projectCut(18 * 1.25 ** 5)
  await page.mouse.move(deep.x, deep.y)
  await page.waitForTimeout(100)
  await expect(page.locator('.annotation-card')).toHaveCount(0)
})

test('a wide gallery places the card beside the record instead of at the window edge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 2000, height: 756 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  for (let i = 0; i < 4; i++)
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await page.waitForTimeout(100)
  const project = await coverProjection(page)
  const cut = cuts.find((item) => item.id === 'stylus')!
  const point = project(cut.point)
  await page.mouse.move(point.x, point.y)
  const card = page.locator('[data-inscription="stylus"] .annotation-card')
  await expect(card).toBeVisible()
  await expect(card).not.toHaveAttribute('data-docked')
  const outline = Array.from({ length: 96 }, (_, i) =>
    project([
      0.5 + Math.cos((i / 96) * Math.PI * 2) * 0.5,
      0.5 + Math.sin((i / 96) * Math.PI * 2) * 0.5,
    ]),
  )
  const left = Math.max(0, Math.min(...outline.map((p) => p.x))),
    right = Math.min(2000, Math.max(...outline.map((p) => p.x)))
  const box = (await card.boundingBox())!
  const gap = box.x + box.width <= left ? left - box.x - box.width : box.x - right
  expect(gap).toBeGreaterThanOrEqual(12)
  expect(gap).toBeLessThan(40)
  expect(box.x).toBeGreaterThan(100)
  expect(box.x + box.width).toBeLessThan(1900)
})
