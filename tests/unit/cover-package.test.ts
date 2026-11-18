import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeCoverPackage } from '../../src/lib/cover-package'
import { unpackCoverRelief } from '../../src/lib/cover-loader'
import { parseCoverRelief } from '../../src/lib/engraved-cover'

const raw = readFileSync('public/assets/cover-relief.bin')
const gzip = readFileSync('public/assets/cover-relief.pack.bin')
const packed = gunzipSync(gzip)
const arrayBuffer = (bytes: Uint8Array) => Uint8Array.from(bytes).buffer

describe('Lossless cover loading package', () => {
  it('reconstructs every original attribute and triangle-index byte, including derived UVs', async () => {
    const decoded = await decodeCoverPackage(arrayBuffer(packed))
    expect(Buffer.from(decoded).equals(raw)).toBe(true)
  })

  it('loads the gzip package with the original geometry bounds', async () => {
    const optimized = await unpackCoverRelief(arrayBuffer(gzip))
    const original = parseCoverRelief(arrayBuffer(raw))
    for (const key of ['face', 'bevel', 'floor'] as const) {
      expect(optimized[key].boundingBox).toEqual(original[key].boundingBox)
      expect(optimized[key].boundingSphere).toEqual(original[key].boundingSphere)
    }
  })

  it('rejects malformed lengths, unsupported formats, oversized allocations and invalid metadata', async () => {
    await expect(decodeCoverPackage(new ArrayBuffer(8))).rejects.toThrow('Invalid packed')
    await expect(decodeCoverPackage(arrayBuffer(packed.subarray(0, -1)))).rejects.toThrow(
      'Invalid packed',
    )
    for (const [word, value] of [
      [0, 0],
      [1, 99],
      [2, 0xffffffff],
      [3, 8],
      [12, 0xffffffff],
    ]) {
      const corrupt = arrayBuffer(packed)
      new Uint32Array(corrupt, 0, 24)[word] = value
      await expect(decodeCoverPackage(corrupt)).rejects.toThrow('Invalid packed')
    }
    const corrupt = arrayBuffer(packed)
    new Uint8Array(corrupt)[96] = 0
    await expect(decodeCoverPackage(corrupt)).rejects.toThrow()
  })
})
