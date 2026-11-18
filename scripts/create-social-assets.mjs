import fs from 'node:fs/promises'
import sharp from 'sharp'

// A static card is readable by link unfurlers without running the 3D exhibit.
// Use the bundled NASA/JPL-Caltech reference photograph; keep its credit on the card.
const photograph = (await fs.readFile('public/assets/cover-original.jpg')).toString('base64')
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="fade">
      <stop offset="0" stop-color="#0b090f"/>
      <stop offset=".8" stop-color="#0b090f"/>
      <stop offset="1" stop-color="#0b090f" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#0b090f"/>
  <image x="590" y="0" width="630" height="630" href="data:image/jpeg;base64,${photograph}"/>
  <rect width="705" height="630" fill="url(#fade)"/>
  <g font-family="sans-serif" fill="#d5b477">
    <text x="64" y="91" font-size="18" letter-spacing="3">VOYAGER · 1977</text>
    <text x="64" y="491" font-size="18" letter-spacing="1">Orbit · Explore · Listen</text>
  </g>
  <g font-family="Georgia, serif" fill="#f3f0e8" font-size="84">
    <text x="60" y="220">The Golden</text>
    <text x="60" y="311">Record</text>
  </g>
  <g font-family="sans-serif" fill="#b8b7b5" font-size="23">
    <text x="64" y="380">A message from Earth.</text>
    <text x="64" y="416">An interactive 3D exhibit.</text>
  </g>
  <text x="64" y="577" font-family="sans-serif" fill="#88858b" font-size="13">Reference photography: NASA/JPL-Caltech</text>
</svg>`
await sharp(Buffer.from(card)).png({ compressionLevel: 9 }).toFile('public/social-preview.png')
const favicon = await fs.readFile('public/favicon.svg')
await sharp(favicon).resize(48, 48).png().toFile('public/favicon-48.png')
await sharp(favicon)
  .resize(180, 180)
  .flatten({ background: '#ffffff' })
  .png()
  .toFile('public/apple-touch-icon.png')
console.log('Created 1200×630 social preview and PNG icons.')
