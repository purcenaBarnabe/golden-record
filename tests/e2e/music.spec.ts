import { test, expect, type Page, type Route } from '@playwright/test'

const archiveAudio = /https:\/\/archive\.org\/download\/the-golden-voyager-record\/.+\.mp3/
function silentRecording(seconds = 12) {
  const rate = 8000,
    length = rate * seconds
  const wave = Buffer.alloc(44 + length, 128)
  wave.write('RIFF', 0)
  wave.writeUInt32LE(length + 36, 4)
  wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16)
  wave.writeUInt16LE(1, 20)
  wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(rate, 24)
  wave.writeUInt32LE(rate, 28)
  wave.writeUInt16LE(1, 32)
  wave.writeUInt16LE(8, 34)
  wave.write('data', 36)
  wave.writeUInt32LE(length, 40)
  return wave
}
async function serveRecording(route: Route) {
  const wave = silentRecording()
  const match = /^bytes=(\d+)-(\d*)/.exec(route.request().headers().range ?? '')
  const start = match ? Number(match[1]) : 0
  const end = Math.min(wave.length - 1, match?.[2] ? Number(match[2]) : wave.length - 1)
  await route.fulfill({
    status: match ? 206 : 200,
    contentType: 'audio/wav',
    body: wave.subarray(start, end + 1),
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
      ...(match ? { 'Content-Range': `bytes ${start}-${end}/${wave.length}` } : {}),
    },
  })
}
async function openPlaylist(page: Page) {
  await page.goto('/')
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await page.locator('.listen-caption').click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('The Sounds of Earth')
}

test('the reverse-face card stays stable and opens the full playlist without preloading audio', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (archiveAudio.test(request.url())) requests.push(request.url())
  })
  await page.goto('/')
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  const marker = page.getByRole('button', { name: 'Explore the Sounds of Earth', exact: true })
  await marker.hover({ timeout: 60_000 })
  const card = page.locator('.music-info-card')
  await expect(card).toContainText('27 musical selections')
  await card.evaluate((node) => node.setAttribute('data-stability', 'original'))
  const box = (await card.boundingBox())!
  await page.mouse.move(box.x + box.width - 8, box.y + 8, { steps: 10 })
  await page.mouse.move(box.x + 8, box.y + box.height - 8, { steps: 10 })
  await expect(card).toHaveAttribute('data-stability', 'original')
  await page.getByRole('button', { name: 'Listen to the record', exact: true }).click()
  await expect(page.locator('.music-track')).toHaveCount(27)
  await expect(page.locator('audio')).not.toHaveAttribute('src')
  expect(requests).toEqual([])
  await page.getByRole('button', { name: 'Greetings & sounds 4' }).click()
  await expect(page.locator('.music-track')).toHaveCount(4)
  await page.getByRole('button', { name: 'Music 27', exact: true }).click()
  await page.getByRole('searchbox').fill('china')
  await expect(page.locator('.music-track')).toHaveCount(1)
  await expect(page.locator('.music-track')).toContainText('Guan Pinghu')
  await page.getByRole('searchbox').fill('nothing matches')
  await expect(page.getByText('No tracks found.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear search', exact: true }).last().click()
  await expect(page.locator('.music-track')).toHaveCount(27)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('native audio supports choosing, seeking, volume, queue advance and listening while inspecting', async ({
  page,
}) => {
  const requests: string[] = []
  await page.route(archiveAudio, async (route) => {
    requests.push(route.request().url())
    await serveRecording(route)
  })
  await openPlaylist(page)
  await page.getByRole('searchbox').fill('chuck berry')
  await page.getByRole('button', { name: 'Play Johnny B. Goode', exact: true }).click()
  await expect
    .poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0)
  expect(new Set(requests).size).toBe(1)
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
  await expect
    .poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused))
    .toBe(true)
  const seek = page.getByRole('slider', { name: 'Seek in track' })
  await seek.focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowRight')
  await expect
    .poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(1)
  await page.getByRole('slider', { name: 'Volume' }).focus()
  await page.keyboard.press('Home')
  await expect
    .poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.volume))
    .toBe(0)
  await page.keyboard.press('End')
  await page.getByRole('button', { name: 'Play playback', exact: true }).click()
  await page.getByRole('button', { name: 'Close playlist' }).click()
  await expect(page.getByRole('complementary', { name: 'Now playing' })).toContainText(
    'Johnny B. Goode',
  )
  await page.getByRole('switch', { name: 'Show record' }).setChecked(false)
  await expect
    .poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused))
    .toBe(false)
  await page.getByRole('button', { name: 'Pause music' }).click()
  await page.getByRole('button', { name: 'Open music playlist' }).click()
  await expect(page.locator('.music-track')).toHaveCount(27)
  await page.getByRole('button', { name: 'Next track', exact: true }).click()
  await expect(page.locator('.now-playing')).toContainText('Mariuamangɨ')
  await expect(page.getByRole('slider', { name: 'Seek in track' })).toBeEnabled()
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => {
    audio.currentTime = audio.duration - 0.05
  })
  await expect(page.locator('.now-playing')).toContainText('Sokaku-Reibo')
  await page.getByRole('searchbox').fill('cavatina')
  await page.getByRole('button', { name: /Play String Quartet No. 13/ }).click()
  await expect(page.getByRole('button', { name: 'Next track', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Close playlist' }).click()
  await page.getByRole('button', { name: 'Stop listening' }).click()
  await expect(page.locator('.mini-player')).toHaveCount(0)
  await expect(page.locator('audio')).not.toHaveAttribute('src')
})

test('a failed recording can be retried without losing the playlist', async ({ page }) => {
  let requests = 0
  await page.route(archiveAudio, async (route) => {
    requests++
    if (requests === 1) await route.fulfill({ status: 503, body: 'Unavailable' })
    else await serveRecording(route)
  })
  await openPlaylist(page)
  await page.getByRole('button', { name: 'Greetings & sounds 4' }).click()
  await page.getByRole('button', { name: 'Play playback', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('This recording could not load')
  await page.getByRole('button', { name: 'Retry playback' }).click()
  await expect
    .poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.music-track')).toHaveCount(4)
  await expect(page.locator('.now-playing')).toContainText('Greeting from the United Nations')
})

test('mobile and landscape playlists keep scrolling tracks and transport within the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPlaylist(page)
  await expect(page.locator('.music-track')).toHaveCount(27)
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport)
    const bounds = (await page.getByRole('dialog').boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
    await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeInViewport()
    await page.locator('.music-track').last().scrollIntoViewIfNeeded()
    await expect(page.locator('.music-track').last()).toBeInViewport()
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true)
  }
})

test('the music remains accessible after a WebGL context is lost', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
  await page
    .locator('canvas')
    .evaluate((canvas) => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
  await expect(page.locator('.webgl-fallback')).toBeVisible()
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await page.locator('.listen-caption').click()
  await expect(page.locator('.music-track')).toHaveCount(27)
})

test('manual orbit updates the visible surface and phone info cards stay in bounds', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
  await page.mouse.move(1200, 680)
  await page.mouse.down()
  await page.mouse.move(100, 680, { steps: 25 })
  await page.mouse.up()
  await expect(page.getByRole('switch', { name: 'Show record' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(
    page.getByRole('button', { name: 'Explore the Sounds of Earth', exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const marker = page.getByRole('button', { name: 'Explore the Sounds of Earth', exact: true })
  await marker.hover()
  await marker.focus()
  const card = page.locator('.music-info-card')
  await expect(card).toBeVisible()
  const bounds = (await card.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(11)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(379)
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)
})
