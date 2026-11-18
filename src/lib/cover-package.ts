import { MeshoptDecoder } from 'meshoptimizer/decoder'
import { COVER_RADIUS } from './artifact-dimensions'

const MAGIC = 0x4b505247
const HEADER_BYTES = 96
const MAX_DECODED_BYTES = 32 * 1024 * 1024
const decoderReady = MeshoptDecoder.supported
  ? MeshoptDecoder.ready.then(
      () => true,
      () => false,
    )
  : Promise.resolve(false)

export function canDecodeCoverPackage() {
  return decoderReady
}

/** Restore the original V2 bytes without quantization, filtering or triangle rotation. */
export async function decodeCoverPackage(buffer: ArrayBuffer) {
  const invalid = () => new Error('Invalid packed cover relief')
  if (buffer.byteLength < HEADER_BYTES) throw invalid()
  const header = new Uint32Array(buffer, 0, HEADER_BYTES / 4)
  const rawBytes = header[2]
  const flags = header[3]
  const original = header.slice(4, 12)
  const sizes = header.slice(12, 24)
  const expected = [0, 1, 2].reduce(
    (sum, i) => sum + original[2 + i] * 32 + original[5 + i] * 4,
    32,
  )
  if (
    header[0] !== MAGIC ||
    header[1] !== 1 ||
    flags & ~7 ||
    original[0] !== 0x47524356 ||
    original[1] !== 2 ||
    rawBytes !== expected ||
    rawBytes > MAX_DECODED_BYTES ||
    HEADER_BYTES + sizes.reduce((sum, size) => sum + size, 0) !== buffer.byteLength ||
    [0, 1, 2].some((i) => !original[2 + i] || !original[5 + i] || original[5 + i] % 3)
  )
    throw invalid()
  if (!(await decoderReady)) throw new Error('Packed cover decoder is unavailable')

  const raw = new ArrayBuffer(rawBytes)
  new Uint32Array(raw, 0, 8).set(original)
  let sourceOffset = HEADER_BYTES
  let targetOffset = 32
  for (let geometry = 0; geometry < 3; geometry++) {
    const vertices = original[2 + geometry]
    let positions: Float32Array | undefined
    for (const [attribute, stride] of [12, 12, 8, 4].entries()) {
      const count = attribute === 3 ? original[5 + geometry] : vertices
      const length = sizes[geometry * 4 + attribute]
      const target = new Uint8Array(raw, targetOffset, count * stride)
      if (attribute === 2 && flags & (1 << geometry)) {
        if (length !== 0 || !positions) throw invalid()
        const uv = new Float32Array(raw, targetOffset, vertices * 2)
        for (let i = 0; i < vertices; i++) {
          uv[i * 2] = positions[i * 3] / (COVER_RADIUS * 2) + 0.5
          uv[i * 2 + 1] = positions[i * 3 + 1] / (COVER_RADIUS * 2) + 0.5
        }
      } else {
        if (!length) throw invalid()
        const source = new Uint8Array(buffer, sourceOffset, length)
        if (attribute === 3) MeshoptDecoder.decodeIndexSequence(target, count, stride, source)
        else MeshoptDecoder.decodeVertexBuffer(target, count, stride, source)
      }
      if (attribute === 0) positions = new Float32Array(raw, targetOffset, vertices * 3)
      sourceOffset += length
      targetOffset += target.byteLength
    }
  }
  return raw
}
