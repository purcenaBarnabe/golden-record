import sharp from 'sharp'
import fs from 'node:fs/promises'

const size = 8192
let svg = await fs.readFile('public/assets/cover-artwork-source.svg', 'utf8')
// The public-domain transcription includes a white disc. Remove that border;
// the 3D geometry supplies the silhouette and the real central mounting hole.
const silhouette = /<path\s[^>]*id="path3272"[^>]*\/>/s
const sourceViewport = 'width="606" height="600" viewBox="106 261 505 500"'
if (!silhouette.test(svg) || !svg.includes(sourceViewport))
  throw new Error(
    'The source SVG layout changed; verify its silhouette and viewport before regeneration.',
  )
svg = svg.replace(silhouette, '')
svg = svg.replace(sourceViewport, `width="${size}" height="${size}" viewBox="117 271 484 482"`)
await fs.writeFile('public/assets/cover-artwork.svg', svg)
await fs.mkdir('public/assets/diagrams', { recursive: true })
const content = await fs.readFile('src/lib/inscriptions.ts', 'utf8')
// Accept formatter-inserted newlines without silently skipping diagram crops.
const crops = [...content.matchAll(/id:\s*'([a-z]+)'[\s\S]*?crop:\s*\[([0-9.,\s]+)\]/g)]
if (crops.length !== 8 || new Set(crops.map((match) => match[1])).size !== 8)
  throw new Error('Expected eight unique engraving crops.')
for (const match of crops) {
  const [x, y, w, h] = match[2].split(',').map(Number)
  if (
    ![x, y, w, h].every(Number.isFinite) ||
    x < 0 ||
    y < 0 ||
    w <= 0 ||
    h <= 0 ||
    x + w > 1 ||
    y + h > 1
  )
    throw new Error(`Invalid crop: ${match[1]}`)
  let source = Buffer.from(svg)
  if (match[1] === 'pulsars') {
    // Its wide bounding box includes three neighboring figures; exclude them
    // from the isolated preview while retaining the long galactic reference line.
    const exclusions = [
      [0.58, 0.54, 0.18, 0.15],
      [0.59, 0.8, 0.18, 0.11],
      [0.1, 0.46, 0.31, 0.13],
    ]
    const mask = `<svg width="${size}" height="${size}">${exclusions.map(([a, b, c, d]) => `<rect x="${a * size}" y="${b * size}" width="${c * size}" height="${d * size}" fill="white"/>`).join('')}</svg>`
    source = await sharp(source)
      .composite([{ input: Buffer.from(mask), blend: 'dest-out' }])
      .png()
      .toBuffer()
  }
  await sharp(source)
    .extract({
      left: Math.round(x * size),
      top: Math.round(y * size),
      width: Math.round(w * size),
      height: Math.round(h * size),
    })
    .resize({ width: 1000, height: 500, fit: 'inside' })
    .webp({ lossless: true })
    .toFile(`public/assets/diagrams/${match[1]}.webp`)
}
// Recover the photo-engraved label as a neutral reflectance map. The dark runout
// ring in NASA's photograph is a reflection, not a black paper/vinyl surface.
const rn = 4096
const reference = await sharp('public/assets/record-original.jpg')
  .extract({ left: 24, top: 28, width: 1888, height: 1888 })
  .resize(rn, rn)
  .greyscale()
  .raw()
  .toBuffer()
const radialSums = new Float64Array(2048),
  radialCounts = new Uint32Array(2048)
for (let y = 0; y < rn; y++)
  for (let x = 0; x < rn; x++) {
    const r = Math.hypot(x - rn / 2, y - rn / 2) / (rn / 2),
      bin = Math.min(2047, Math.floor(r * 2048))
    radialSums[bin] += reference[y * rn + x]
    radialCounts[bin]++
  }
const albedo = Buffer.alloc(rn * rn * 3),
  rr = Buffer.alloc(rn * rn),
  aniso = Buffer.alloc(rn * rn * 3)
for (let y = 0; y < rn; y++)
  for (let x = 0; x < rn; x++) {
    const i = y * rn + x,
      dx = (x - rn / 2) / (rn / 2),
      dy = (y - rn / 2) / (rn / 2),
      r = Math.hypot(dx, dy),
      value = reference[i]
    let ink = 0
    if (r > 0.105 && r < 0.342) ink = Math.max(0, Math.min(1, (222 - value) / 208))
    else if (r >= 0.342 && r < 0.49) {
      const bin = Math.min(2047, Math.floor(r * 2048)),
        average = radialSums[bin] / Math.max(1, radialCounts[bin])
      ink = Math.max(0, Math.min(0.83, (value - average - 10) / 85))
    }
    const v = 250 - ink * 222
    for (let c = 0; c < 3; c++) albedo[i * 3 + c] = v
    rr[i] = r < 0.343 ? 115 + ink * 91 : r < 0.49 ? 70 + ink * 110 : 89
    const theta = Math.atan2(-dy, dx)
    aniso[i * 3] = Math.round((-Math.sin(theta) * 0.5 + 0.5) * 255)
    aniso[i * 3 + 1] = Math.round((Math.cos(theta) * 0.5 + 0.5) * 255)
    aniso[i * 3 + 2] = r > 0.49 ? 255 : 28
  }
await Promise.all([
  sharp(albedo, { raw: { width: rn, height: rn, channels: 3 } })
    .webp({ quality: 98 })
    .toFile('public/assets/record-albedo.webp'),
  sharp(rr, { raw: { width: rn, height: rn, channels: 1 } })
    .resize(2048, 2048)
    .webp({ quality: 96 })
    .toFile('public/assets/record-roughness.webp'),
  sharp(aniso, { raw: { width: rn, height: rn, channels: 3 } })
    .resize(2048, 2048)
    .webp({ quality: 96 })
    .toFile('public/assets/record-anisotropy.webp'),
])
await import('./prepare-engraving.mjs')
await import('./prepare-record-finish.mjs')
console.log(
  'Prepared physical diagram cuts, 4K photo-engraved label and directional anisotropy maps.',
)
