import { BufferAttribute, BufferGeometry, FileLoader, Loader } from 'three'

export interface CoverRelief {
  face: BufferGeometry
  bevel: BufferGeometry
  floor: BufferGeometry
}

export function parseCoverRelief(buffer: ArrayBuffer): CoverRelief {
  if (buffer.byteLength < 32) throw new Error('Invalid cover relief')
  const header = new Uint32Array(buffer, 0, 8)
  if (header[0] !== 0x47524356 || ![1, 2].includes(header[1]))
    throw new Error('Invalid cover relief')
  // Preflight the whole asset before allocating GPU-side geometry or building
  // picking trees. Counts describe packed float32 attributes and uint32 indices.
  const counts = Array.from(header.slice(2, 5))
  const indexed = header[1] === 2
  const expectedBytes = counts.reduce(
    (total, count, i) => total + count * 32 + (indexed ? header[5 + i] * 4 : 0),
    32,
  )
  if (
    expectedBytes !== buffer.byteLength ||
    counts.some(
      (count, i) =>
        count === 0 || (indexed ? header[5 + i] === 0 || header[5 + i] % 3 !== 0 : count % 3 !== 0),
    )
  ) {
    throw new Error('Invalid cover relief layout')
  }
  let cursor = 32
  for (const [i, count] of counts.entries()) {
    const attributes = new Float32Array(buffer, cursor, count * 8)
    if (attributes.some((value) => !Number.isFinite(value)))
      throw new Error('Invalid cover relief attributes')
    cursor += attributes.byteLength
    if (indexed) {
      const indices = new Uint32Array(buffer, cursor, header[5 + i])
      if (indices.some((index) => index >= count)) throw new Error('Invalid cover relief indices')
      cursor += indices.byteLength
    }
  }
  let offset = 32
  const geometries = counts.map((count, i) => {
    const geometry = new BufferGeometry()
    for (const [name, size] of [
      ['position', 3],
      ['normal', 3],
      ['uv', 2],
    ] as const) {
      geometry.setAttribute(
        name,
        new BufferAttribute(new Float32Array(buffer, offset, count * size), size),
      )
      offset += count * size * 4
    }
    if (indexed) {
      const indexCount = header[5 + i]
      geometry.setIndex(new BufferAttribute(new Uint32Array(buffer, offset, indexCount), 1))
      offset += indexCount * 4
    }
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  })
  return { face: geometries[0], bevel: geometries[1], floor: geometries[2] }
}

export class EngravedCoverLoader extends Loader<CoverRelief> {
  load(
    url: string,
    onLoad: (relief: CoverRelief) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    new FileLoader(this.manager)
      .setPath(this.path)
      .setResponseType('arraybuffer')
      .load(
        url,
        (data) => {
          try {
            onLoad(parseCoverRelief(data as ArrayBuffer))
          } catch (error) {
            onError?.(error)
          }
        },
        onProgress,
        onError,
      )
  }
}
