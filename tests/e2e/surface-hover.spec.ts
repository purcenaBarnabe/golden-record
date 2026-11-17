import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import { parseCoverRelief } from '../../src/lib/engraved-cover'
import { ARTIFACT_CENTER_Y, COVER_FACE_Z, COVER_RADIUS } from '../../src/lib/artifact-dimensions'
import { inscriptionAtUv, inscriptions } from '../../src/lib/inscriptions'

// Recover the planar projection from DOM marker positions instead of relying
// on camera internals or introducing a production-only test/debug API.
async function coverProjection(page: Page) {
  const equations: number[][] = []
  for (const id of ['playback', 'scan', 'pulsars', 'hydrogen']) {
    const item = inscriptions.find((item) => item.id === id)!
    const [u, v] = item.point
    const box = (await page
      .locator(`.annotation[data-inscription="${id}"] .annotation-dot`)
      .boundingBox())!
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2
    equations.push([u, v, 1, 0, 0, 0, -x * u, -x * v, x], [0, 0, 0, u, v, 1, -y * u, -y * v, y])
  }
  for (let i = 0; i < 8; i++) {
    let pivot = i
    for (let j = i + 1; j < 8; j++)
      if (Math.abs(equations[j][i]) > Math.abs(equations[pivot][i])) pivot = j
    ;[equations[i], equations[pivot]] = [equations[pivot], equations[i]]
    const scale = equations[i][i]
    for (let k = i; k < 9; k++) equations[i][k] /= scale
    for (let j = 0; j < 8; j++)
      if (j !== i) {
        const factor = equations[j][i]
        for (let k = i; k < 9; k++) equations[j][k] -= factor * equations[i][k]
      }
  }
  const h = equations.map((row) => row[8])
  return ([u, v]: number[]) => ({
    x: (h[0] * u + h[1] * v + h[2]) / (h[6] * u + h[7] * v + 1),
    y: (h[3] * u + h[4] * v + h[5]) / (h[6] * u + h[7] * v + 1),
  })
}

const bytes = readFileSync('public/assets/cover-relief.bin')
const floor = parseCoverRelief(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
).floor
const cuts = inscriptions.map((item) => {
  const p = floor.getAttribute('position'),
    index = floor.index!
  let closest = Infinity,
    point: number[] = []
  for (let i = 0; i < index.count; i += 3) {
    const indices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    const u = 0.5 + indices.reduce((sum, id) => sum + p.getX(id), 0) / (6 * COVER_RADIUS)
    const v = 0.5 - indices.reduce((sum, id) => sum + p.getY(id), 0) / (6 * COVER_RADIUS)
    if (inscriptionAtUv(u, 1 - v)?.id !== item.id) continue
    const distance = Math.hypot(u - item.point[0], v - item.point[1])
    if (distance < closest) {
      closest = distance
      point = [u, v]
    }
  }
  return { id: item.id, point }
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
      for (const uv of [
        [0.25, 0.33],
        [0.7, 0.47],
        [0.68, 0.61],
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
    for (const cut of cuts) {
      await page.mouse.move(12, viewport.height - 12)
      await expect(page.locator('.annotation-card')).toHaveCount(0)
      const point = project(cut.point)
      await page.mouse.move(point.x, point.y)
      const card = page.locator(`[data-inscription="${cut.id}"] .annotation-card`)
      await expect(card).toBeVisible()
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
