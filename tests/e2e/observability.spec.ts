import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { revealEngravingMarkers } from './helpers/interaction'

test.skip(!process.env.PLAYWRIGHT_SENTRY_DSN, 'Run with a dummy PLAYWRIGHT_SENTRY_DSN.')
const policy = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)![1]
const audioUrl = /https:\/\/archive\.org\/download\/the-golden-voyager-record\/.+\.mp3/

async function collectTelemetry(page: Page) {
  const payloads: string[] = []
  await page.route('**://*.ingest.us.sentry.io/**', async (route) => {
    payloads.push(route.request().postData() ?? '')
    await route.fulfill({
      status: 200,
      body: '{}',
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  })
  // Exercise the same CSP as the Pages deployment, using a dummy key on its allowed host.
  await page.route('**/', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': policy,
      },
    })
  })
  return payloads
}

function silentRecording() {
  const length = 8_000 * 12
  const wave = Buffer.alloc(44 + length, 128)
  wave.write('RIFF', 0)
  wave.writeUInt32LE(length + 36, 4)
  wave.write('WAVEfmt ', 8)
  wave.writeUInt32LE(16, 16)
  wave.writeUInt16LE(1, 20)
  wave.writeUInt16LE(1, 22)
  wave.writeUInt32LE(8_000, 24)
  wave.writeUInt32LE(8_000, 28)
  wave.writeUInt16LE(1, 32)
  wave.writeUInt16LE(8, 34)
  wave.write('data', 36)
  wave.writeUInt32LE(length, 40)
  return wave
}

test('card, exhibit, and player interactions reach the transport without search text', async ({
  page,
}) => {
  const payloads = await collectTelemetry(page)
  await page.route(audioUrl, (route) =>
    route.fulfill({ contentType: 'audio/wav', body: silentRecording() }),
  )
  await page.goto('/')
  await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false')
  await revealEngravingMarkers(page)
  await page.locator('.annotation-dot').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Next engraving' }).click()
  await page.getByRole('button', { name: 'Close information' }).click()
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await page.locator('.listen-caption').click()
  await page.getByRole('searchbox').fill('private search must never be sent')
  await expect
    .poll(() => payloads.some((body) => body.includes('audio.searched')), { timeout: 20_000 })
    .toBe(true)
  await page.getByRole('button', { name: 'Clear search', exact: true }).first().click()
  await page.locator('.music-track').first().click()
  await expect
    .poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime))
    .toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
  await expect
    .poll(() => payloads.some((body) => body.includes('audio.paused')), { timeout: 20_000 })
    .toBe(true)
  const sent = payloads.join('\n')
  for (const action of [
    'scene.ready',
    'artifact.changed',
    'infocard.opened',
    'infocard.closed',
    'panel.opened',
    'audio.track_selected',
    'audio.playing',
  ])
    expect(sent.includes(action), `Expected telemetry for ${action}`).toBe(true)
  expect(sent.includes('exhibit.scene.load.duration')).toBe(true)
  expect(sent.includes('exhibit.audio.startup.duration')).toBe(true)
  expect(sent.includes('private search must never be sent')).toBe(false)
})

test('a recording failure is reported once and autoplay denial stays out of Issues', async ({
  page,
}) => {
  const payloads = await collectTelemetry(page)
  await page.route(audioUrl, (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/')
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await page.locator('.listen-caption').click()
  await page.locator('.music-track').first().click()
  await expect(page.getByRole('alert')).toContainText('This recording could not load')
  const errors = () => payloads.filter((payload) => payload.includes('"type":"event"'))
  await expect.poll(() => errors().length).toBe(1)
  expect(errors()[0]).toContain('"feature":"audio"')
  await page.locator('audio').evaluate((audio: HTMLAudioElement) => {
    Object.defineProperty(audio, 'error', { get: () => null })
    audio.play = () =>
      Promise.reject(new DOMException('Expected autoplay restriction', 'NotAllowedError'))
  })
  await page.getByRole('button', { name: 'Retry playback' }).click()
  await expect(page.getByRole('alert')).toContainText('Press play')
  await expect
    .poll(() => payloads.some((body) => body.includes('audio.play_blocked')), { timeout: 20_000 })
    .toBe(true)
  expect(errors()).toHaveLength(1)
})
