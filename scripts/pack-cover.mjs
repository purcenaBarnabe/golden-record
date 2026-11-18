import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { MeshoptEncoder } from 'meshoptimizer/encoder'

// GRPK v1: 24 uint32 words, then twelve lossless attribute/index streams.
export async function packCoverRelief() {
  await MeshoptEncoder.ready
  const raw = await fs.readFile('public/assets/cover-relief.bin')
  const original = new Uint32Array(raw.buffer, raw.byteOffset, 8)
  if (original[0] !== 0x47524356 || original[1] !== 2)
    throw new Error('The cover packer requires the indexed V2 reference asset')
  const chunks = []
  const lengths = []
  let cursor = 32
  let flags = 0
  for (let part = 0; part < 3; part++) {
    const vertices = original[2 + part]
    let positions
    for (const [attribute, stride] of [12, 12, 8, 4].entries()) {
      const count = attribute === 3 ? original[5 + part] : vertices
      const source = new Uint8Array(raw.buffer, raw.byteOffset + cursor, count * stride)
      if (attribute === 0)
        positions = new Float32Array(raw.buffer, raw.byteOffset + cursor, count * 3)
      let derivedUV = false
      if (attribute === 2) {
        const uv = new Float32Array(raw.buffer, raw.byteOffset + cursor, count * 2)
        derivedUV = true
        for (let i = 0; i < count && derivedUV; i++) {
          derivedUV =
            Object.is(uv[i * 2], Math.fround(positions[i * 3] / 0.312 + 0.5)) &&
            Object.is(uv[i * 2 + 1], Math.fround(positions[i * 3 + 1] / 0.312 + 0.5))
        }
      }
      if (derivedUV) {
        flags |= 1 << part
        lengths.push(0)
      } else {
        const encoded =
          attribute === 3
            ? MeshoptEncoder.encodeIndexSequence(source, count, stride)
            : MeshoptEncoder.encodeVertexBufferLevel(source, count, stride, 2, 1)
        lengths.push(encoded.byteLength)
        chunks.push(Buffer.from(encoded))
      }
      cursor += source.byteLength
    }
  }
  if (cursor !== raw.byteLength) throw new Error('Invalid cover reference layout')
  const header = new Uint32Array(24)
  header.set([0x4b505247, 1, raw.byteLength, flags])
  header.set(original, 4)
  header.set(lengths, 12)
  const packed = Buffer.concat([Buffer.from(header.buffer), ...chunks])
  const compressed = gzipSync(packed, { level: 9 })
  // A binary suffix avoids host-specific automatic Content-Encoding for .gz files.
  // The loader handles the gzip envelope consistently on static hosts.
  await fs.writeFile('public/assets/cover-relief.pack.bin', compressed)
  await fs.writeFile(
    'public/assets/cover-loading.json',
    JSON.stringify(
      {
        version: 1,
        codec: 'meshoptimizer 1.0.1 + gzip; no quantization',
        source: 'cover-relief.bin',
        rawBytes: raw.byteLength,
        packedBytes: packed.byteLength,
        gzipBytes: compressed.byteLength,
        sourceSha256: createHash('sha256').update(raw).digest('hex'),
        packageSha256: createHash('sha256').update(compressed).digest('hex'),
        derivedUVMask: flags,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(
    `Packed exact cover geometry: ${(raw.byteLength / 1048576).toFixed(2)} → ${(compressed.byteLength / 1048576).toFixed(2)} MiB.`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await packCoverRelief()
