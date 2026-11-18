import { chromium, expect } from '@playwright/test'
import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
)
const out = options.out ?? 'artifacts/performance/initial-load/quality'
if (!options.baseline || !options.candidate) throw new Error('Pass --baseline=URL --candidate=URL')
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
})

async function settled(page) {
  await page.locator('#viewer-controls').focus()
  await page.mouse.move(0, 0)
  await expect(page.locator('.annotation-card')).toHaveCount(0)
  await expect(page.locator('#artifact')).not.toHaveAttribute('data-callout-dock')
  const viewport = page.viewportSize()
  await expect
    .poll(async () => {
      const box = await page.locator('canvas').boundingBox()
      return Math.abs(box.width - viewport.width) + Math.abs(box.height - viewport.height)
    })
    .toBeLessThan(1)
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const gl = document.querySelector('canvas').getContext('webgl2')
              const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
              gl.flush()
              const check = () => {
                const status = gl.clientWaitSync(fence, 0, 0)
                if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
                  gl.deleteSync(fence)
                  resolve()
                } else requestAnimationFrame(check)
              }
              check()
            }),
          ),
        )
      }),
  )
}

async function light(page, mode) {
  const label = mode === 'studio' ? 'Use studio light' : 'Use raking light'
  const button = page.locator(`button[aria-label="${label}"]`)
  // Quality-only setup: hidden desktop controls can establish the same pose on a phone viewport.
  if (await button.count()) await button.evaluate((element) => element.click())
}

const comparisons = []
try {
  for (const profile of ['desktop', 'mobile']) {
    for (const theme of ['light', 'dark']) {
      for (const [variant, url] of [
        ['baseline', options.baseline],
        ['candidate', options.candidate],
      ]) {
        const page = await browser.newPage({
          viewport:
            profile === 'desktop' ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
          deviceScaleFactor: profile === 'desktop' ? 1 : 2,
          isMobile: profile === 'mobile',
          hasTouch: profile === 'mobile',
        })
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
        await page.addInitScript((theme) => localStorage.setItem('voyager-theme', theme), theme)
        await page.goto(url)
        await expect(page.getByRole('switch', { name: 'Show record' })).toBeEnabled({
          timeout: 60_000,
        })
        const capture = async (pose) => {
          await settled(page)
          const name = `${profile}-${theme}-${pose}`
          await page.locator('canvas').screenshot({
            path: path.join(out, `${name}-${variant}.png`),
            // Element screenshots also include DOM overlays in the same bounds.
            // Hide their paint only; keep layout, camera and the complete canvas.
            style:
              '.gallery-header,.gallery-bottom,.annotation-layer,.skip-link,[data-radix-popper-content-wrapper]{opacity:0!important}',
          })
          if (variant === 'candidate') comparisons.push(name)
        }
        await capture('cover-studio')
        await light(page, 'raking')
        await capture('cover-raking')
        await light(page, 'studio')
        await page.getByRole('button', { name: 'Explore hydrogen transition', exact: true }).focus()
        await page
          .getByRole('button', { name: 'See it close up', exact: true })
          .evaluate((button) => button.click())
        await capture('cover-macro')
        await page
          .getByRole('button', {
            name: 'Inspect surface texture',
            exact: true,
            includeHidden: true,
          })
          .evaluate((button) => button.click())
        await capture('cover-96x')
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await capture('cover-128x')
        await page.getByRole('button', { name: 'Reset view' }).click()
        await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
        await light(page, 'studio')
        await capture('record-studio')
        await light(page, 'raking')
        await capture('record-raking')
        await page
          .getByRole('button', {
            name: 'Inspect surface texture',
            exact: true,
            includeHidden: true,
          })
          .evaluate((button) => button.click())
        await capture('record-96x')
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
        await capture('record-128x')
        await page.close()
      }
    }
  }
} finally {
  await browser.close()
}

const results = []
for (const name of comparisons) {
  const before = await sharp(path.join(out, `${name}-baseline.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const after = await sharp(path.join(out, `${name}-candidate.png`))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (before.info.width !== after.info.width || before.info.height !== after.info.height)
    throw new Error(`Viewport mismatch: ${name}`)
  let changed = 0,
    total = 0,
    max = 0
  const diff = Buffer.alloc(before.data.length)
  for (let pixel = 0; pixel < before.data.length; pixel += 4) {
    let peak = 0
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(before.data[pixel + channel] - after.data[pixel + channel])
      total += delta
      peak = Math.max(peak, delta)
      max = Math.max(max, delta)
    }
    if (peak > 1) changed++
    diff[pixel] = Math.min(255, peak * 8)
    diff[pixel + 2] = Math.min(255, peak * 8)
    diff[pixel + 3] = 255
  }
  const pixels = before.info.width * before.info.height
  const result = {
    name,
    width: before.info.width,
    height: before.info.height,
    meanAbsoluteChannelDifference: total / (pixels * 3),
    pixelsDifferentByMoreThanOne: changed,
    changedPercent: (changed / pixels) * 100,
    maxChannelDifference: max,
  }
  results.push(result)
  await sharp(diff, { raw: { width: before.info.width, height: before.info.height, channels: 4 } })
    .png()
    .toFile(path.join(out, `${name}-difference.png`))
  console.log(name, JSON.stringify(result))
}
await fs.writeFile(path.join(out, 'comparison.json'), JSON.stringify(results, null, 2) + '\n')
// Allow only isolated rasterization noise, never broad material/lighting changes.
const regressions = results.filter(
  (result) => result.changedPercent > 0.001 || result.meanAbsoluteChannelDifference > 0.001,
)
if (regressions.length)
  throw new Error(`Visual differences exceed the quality gate: ${regressions.map((r) => r.name)}`)
