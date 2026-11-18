import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  COVER_RELIEF_URL,
  RAW_COVER_RELIEF_URL,
  RECORD_TEXTURE_URLS,
} from '../../src/lib/exhibit-assets'

const policy = readFileSync('public/_headers', 'utf8').match(/Content-Security-Policy: (.+)/)![1]

test('optimized assets load once under the deployed content security policy', async ({ page }) => {
  const requests: string[] = []
  const errors: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/', async (route) => {
    const response = await route.fetch()
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': policy },
    })
  })
  await page.goto('/')
  await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
  await expect(page.locator('.webgl-fallback')).toHaveCount(0)
  await expect(page.locator('.annotation-dot')).toHaveCount(8)
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await expect(page.locator('.surface-caption')).toContainText('Side 1')
  expect(requests.filter((url) => url === COVER_RELIEF_URL)).toHaveLength(1)
  expect(requests).not.toContain(RAW_COVER_RELIEF_URL)
  for (const url of RECORD_TEXTURE_URLS)
    expect(requests.filter((request) => request === url)).toHaveLength(1)
  expect(errors).toEqual([])
})

for (const unavailable of ['gzip', 'wasm', 'package', 'network'] as const) {
  test(`the complete exhibit remains available when ${unavailable} decoding is unavailable`, async ({
    page,
  }) => {
    const requests: string[] = []
    page.on('request', (request) => requests.push(new URL(request.url()).pathname))
    if (unavailable === 'package' || unavailable === 'network') {
      await page.route(`**${COVER_RELIEF_URL}`, (route) =>
        route.fulfill({
          status: unavailable === 'network' ? 503 : 200,
          contentType: 'application/octet-stream',
          body: Buffer.from('invalid'),
        }),
      )
    } else {
      await page.addInitScript((feature) => {
        Object.defineProperty(
          globalThis,
          feature === 'gzip' ? 'DecompressionStream' : 'WebAssembly',
          { value: undefined, configurable: true },
        )
      }, unavailable)
    }
    await page.goto('/')
    await expect(page.getByText('Preparing the record')).toHaveCount(0, { timeout: 60_000 })
    await expect(page.locator('.webgl-fallback')).toHaveCount(0)
    await expect(page.locator('.annotation-dot')).toHaveCount(8)
    expect(requests).toContain(RAW_COVER_RELIEF_URL)
    if (unavailable === 'gzip' || unavailable === 'wasm')
      expect(requests).not.toContain(COVER_RELIEF_URL)
    await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
    await expect(page.locator('.surface-caption')).toContainText('Side 1')
  })
}

test('a lost WebGL context keeps the photographs and music available', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false')
  const lost = await page.locator('canvas').evaluate((canvas) => {
    const extension = (canvas as HTMLCanvasElement)
      .getContext('webgl2')
      ?.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return Boolean(extension)
  })
  expect(lost).toBe(true)
  await expect(page.locator('.webgl-fallback img')).toBeVisible()
  await page.getByRole('switch', { name: 'Show record' }).setChecked(true)
  await expect(page.locator('.webgl-fallback img')).toHaveAttribute(
    'src',
    '/assets/record-original.jpg',
  )
  await page.locator('.listen-caption').click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('The Sounds of Earth')
})
