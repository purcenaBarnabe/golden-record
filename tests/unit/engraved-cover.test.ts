import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Matrix4, Vector2 } from 'three'
import { parseCoverRelief } from '../../src/lib/engraved-cover'
import { EngravingPicker } from '../../src/lib/engraving-picking'
import { COVER_RADIUS } from '../../src/lib/artifact-dimensions'

const bytes = readFileSync('public/assets/cover-relief.bin')
const relief = parseCoverRelief(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
)
const picker = new EngravingPicker(relief)
const projection = new Matrix4().makeScale(1 / COVER_RADIUS, 1 / COVER_RADIUS, 1)
const cutAtArtworkPoint = (x: number, y: number) =>
  picker.pick(
    projection,
    new Vector2((x - 359) / 242, (512 - y) / 242),
    { width: 4000, height: 4000 },
    0,
  )

describe('Physical cover engraving', () => {
  it('rejects corrupt headers and truncated or trailing asset data', () => {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    expect(() => parseCoverRelief(new ArrayBuffer(12))).toThrow('Invalid cover relief')
    expect(() => parseCoverRelief(buffer.slice(0, -4))).toThrow('layout')
    const trailing = new Uint8Array(buffer.byteLength + 4)
    trailing.set(new Uint8Array(buffer))
    expect(() => parseCoverRelief(trailing.buffer)).toThrow('layout')
    const invalidHeader = buffer.slice(0)
    new Uint32Array(invalidHeader)[0] = 0
    expect(() => parseCoverRelief(invalidHeader)).toThrow('Invalid cover relief')
  })
  it('rejects non-finite attributes, incomplete triangles and invalid vertex indices', () => {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    const invalidAttribute = buffer.slice(0)
    new Float32Array(invalidAttribute, 32, 1)[0] = NaN
    expect(() => parseCoverRelief(invalidAttribute)).toThrow('attributes')
    const invalidIndex = buffer.slice(0)
    const header = new Uint32Array(invalidIndex, 0, 8)
    new Uint32Array(invalidIndex, 32 + header[2] * 32, 1)[0] = header[2]
    expect(() => parseCoverRelief(invalidIndex)).toThrow('indices')
    const incompleteTriangle = buffer.slice(0)
    new Uint32Array(incompleteTriangle)[5] -= 1
    expect(() => parseCoverRelief(incompleteTriangle)).toThrow('layout')
  })
  it('keeps the outlined cartridge bodies and their apertures as uncut metal', () => {
    // Points inside the white knockout shapes in the original transcription,
    // checked against the supplied cartridge and sound-rotation SVG references.
    for (const [x, y] of [
      [296.7, 388.8],
      [296.7, 395.5],
      [296.6, 406],
      [296.7, 401.5],
      [297.8, 502.5],
      [297.8, 510.3],
    ]) {
      expect(cutAtArtworkPoint(x, y), `${x}, ${y}`).toBeNull()
    }
  })
  it('preserves the engraved outlines around the cartridge apertures', () => {
    expect(cutAtArtworkPoint(295.65216, 395.5)).toBe('playback')
    expect(cutAtArtworkPoint(295.48761, 406)).toBe('playback')
    expect(cutAtArtworkPoint(296.38547, 510.3)).toBe('stylus')
  })
  it('places a real recessed floor below a separate lip and sloped wall', () => {
    expect(relief.face.boundingBox!.min.z).toBe(0)
    expect(relief.bevel.boundingBox!.max.z).toBe(0)
    expect(relief.bevel.boundingBox!.min.z).toBeCloseTo(-0.000045, 9)
    expect(relief.floor.boundingBox!.min.z).toBeCloseTo(-0.000045, 9)
    expect(relief.floor.boundingBox!.max.z).toBeCloseTo(-0.000045, 9)
    const normals = relief.bevel.getAttribute('normal')
    expect(
      Array.from({ length: normals.count }, (_, i) => normals.getZ(i)).some(
        (z) => z > 0.1 && z < 0.95,
      ),
    ).toBe(true)
  })
  it('tessellates the face, walls and floors without covering the cuts or central hole', () => {
    let area = 0
    let uncutArea = 0
    for (const geometry of Object.values(relief)) {
      const p = geometry.getAttribute('position')
      const indices = geometry.index
      for (let i = 0; i < (indices?.count ?? p.count); i += 3) {
        const a = indices?.getX(i) ?? i,
          b = indices?.getX(i + 1) ?? i + 1,
          c = indices?.getX(i + 2) ?? i + 2
        const cross =
          (p.getX(b) - p.getX(a)) * (p.getY(c) - p.getY(a)) -
          (p.getY(b) - p.getY(a)) * (p.getX(c) - p.getX(a))
        expect(cross).toBeGreaterThanOrEqual(0)
        area += cross / 2
        if (geometry === relief.face) uncutArea += cross / 2
      }
    }
    expect(area).toBeCloseTo(Math.PI * ((0.156 - 0.00004) ** 2 - 0.0036 ** 2), 6)
    // These are fine line diagrams: their circular and rectangular interiors
    // must remain metal, rather than accidentally becoming solid cutouts.
    expect(uncutArea / area).toBeGreaterThan(0.97)
  })
})
