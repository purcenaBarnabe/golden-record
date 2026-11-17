import sharp from 'sharp'

// Reconstruct shallow photo-engraving from the existing NASA-derived
// reflectance map. This adds relief without inventing replacement lettering.
const { data, info } = await sharp('public/assets/record-albedo.webp')
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true })
const height = Buffer.alloc(info.width * info.height)
for (let y = 0; y < info.height; y++)
  for (let x = 0; x < info.width; x++) {
    const i = y * info.width + x
    const r = Math.hypot((x / info.width - 0.5) * 2, (y / info.height - 0.5) * 2)
    const ink = r < 0.49 ? Math.max(0, Math.min(1, (250 - data[i]) / 222)) : 0
    height[i] = Math.round(192 - ink * 150)
  }
await sharp(height, { raw: { width: info.width, height: info.height, channels: 1 } })
  .webp({ lossless: true })
  .toFile('public/assets/record-relief.webp')
console.log('Prepared photo-engraved label and dedication relief.')
