import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { parseCoverRelief } from '../../../src/lib/engraved-cover'
import { COVER_RADIUS } from '../../../src/lib/artifact-dimensions'
import { inscriptionAtUv, inscriptions } from '../../../src/lib/inscriptions'

// Recover the planar projection from DOM markers without a production debug API.
export async function coverProjection(page: Page) {
  const equations: number[][] = []
  // Read every marker in the same browser task, including while the camera eases.
  const markers = await page.evaluate(
    (items) =>
      items.map(({ id, markerPoint: [u, v] }) => {
        const box = document
          .querySelector(`.annotation[data-inscription="${id}"] .annotation-dot`)!
          .getBoundingClientRect()
        return { u, v, x: box.x + box.width / 2, y: box.y + box.height / 2 }
      }),
    inscriptions.filter((item) => ['playback', 'scan', 'pulsars', 'hydrogen'].includes(item.id)),
  )
  for (const { u, v, x, y } of markers) {
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
export const cuts = inscriptions.map((item) => {
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
