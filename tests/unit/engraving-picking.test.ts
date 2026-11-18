import { readFileSync } from 'node:fs'
import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector2 } from 'three'
import { describe, expect, it } from 'vitest'
import { parseCoverRelief } from '../../src/lib/engraved-cover'
import { EngravingPicker } from '../../src/lib/engraving-picking'
import { COVER_RADIUS } from '../../src/lib/artifact-dimensions'
import { inscriptionAtUv, inscriptions } from '../../src/lib/inscriptions'

const bytes = readFileSync('public/assets/cover-relief.bin')
const relief = parseCoverRelief(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
)
const indices = [relief.floor.index!.array.slice(), relief.bevel.index!.array.slice()]
const picker = new EngravingPicker(relief)
const matrix = new Matrix4().makeScale(1 / COVER_RADIUS, 1 / COVER_RADIUS, 1)
const viewport = { width: 1000, height: 1000 }
const pointer = (u: number, v: number) => new Vector2(u * 2 - 1, 1 - v * 2)

describe('Picking actual cover engravings', () => {
  it('leaves the uncut interiors of diagrams and spaces between rays inactive', () => {
    for (const [u, v] of [
      [0.25, 0.33],
      [0.7, 0.47],
      [0.68, 0.61],
      [0.5, 0.83],
    ]) {
      expect(inscriptionAtUv(u, 1 - v)).toBeDefined()
      expect(picker.pick(matrix, pointer(u, v), viewport), `${u}, ${v}`).toBeNull()
    }
  })

  it('recognizes real recessed triangles belonging to every diagram', () => {
    const positions = relief.floor.getAttribute('position'),
      index = relief.floor.index!
    const remaining = new Set(inscriptions.map((item) => item.id))
    for (let i = 0; i < index.count && remaining.size; i += 3) {
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
      const u = 0.5 + ids.reduce((sum, id) => sum + positions.getX(id), 0) / (6 * COVER_RADIUS)
      const v = 0.5 - ids.reduce((sum, id) => sum + positions.getY(id), 0) / (6 * COVER_RADIUS)
      const item = inscriptionAtUv(u, 1 - v)
      if (!item || !remaining.has(item.id)) continue
      expect(picker.pick(matrix, pointer(u, v), viewport)).toBe(item.id)
      remaining.delete(item.id)
    }
    expect(remaining.size).toBe(0)
  })

  it('keeps the targeting allowance at four screen pixels as zoom and viewport size change', () => {
    const line = new BufferGeometry().setAttribute(
      'position',
      new Float32BufferAttribute([-0.001, 0, 0, 0.001, 0, 0, 0, 0.000001, 0], 3),
    )
    const thin = new EngravingPicker({ floor: line, bevel: line })
    for (const size of [
      { width: 320, height: 844 },
      { width: 1440, height: 1000 },
    ])
      for (const zoom of [1, 4]) {
        const projection = new Matrix4().makeScale(zoom / COVER_RADIUS, zoom / COVER_RADIUS, 1)
        expect(thin.pick(projection, new Vector2(0, (3.9 * 2) / size.height), size)).not.toBeNull()
        expect(thin.pick(projection, new Vector2(0, (4.2 * 2) / size.height), size)).toBeNull()
      }
    line.dispose()
  })

  it('does not reorder the rendered indices while constructing the acceleration trees', () => {
    for (const [i, geometry] of [relief.floor, relief.bevel].entries()) {
      const current = geometry.index!.array
      expect(
        Buffer.from(current.buffer, current.byteOffset, current.byteLength).equals(
          Buffer.from(indices[i].buffer),
        ),
      ).toBe(true)
    }
  })

  it('clips picking geometry at the near plane without accepting the invisible portion', () => {
    const cut = new BufferGeometry().setAttribute(
      'position',
      new Float32BufferAttribute([-0.02, 0, -2, 0.02, 0, 0, 0, 0.02, 0], 3),
    )
    const clipped = new EngravingPicker({ floor: cut, bevel: cut })
    expect(
      clipped.pick(matrix, new Vector2(0.01 / COVER_RADIUS, 0.001 / COVER_RADIUS), viewport),
    ).not.toBeNull()
    expect(
      clipped.pick(matrix, new Vector2(-0.015 / COVER_RADIUS, 0.001 / COVER_RADIUS), viewport),
    ).toBeNull()
    expect(
      clipped.pick(
        new Matrix4().makeTranslation(0, 0, -3).multiply(matrix),
        new Vector2(),
        viewport,
      ),
    ).toBeNull()
    cut.dispose()
  })
})
