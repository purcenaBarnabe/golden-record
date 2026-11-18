import { expect, test } from '@playwright/test'
import { inscriptions } from '../../src/lib/inscriptions'
import { ptBR } from '../../src/lib/i18n/pt-BR'

const archiveAudio = /https:\/\/archive\.org\/download\/the-golden-voyager-record\/.+\.mp3/

test.describe('Brazilian Portuguese', () => {
  test.use({ locale: 'pt-BR' })

  test('localizes the document, accessible controls, materials and all eight diagrams', async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page).toHaveTitle(ptBR.seo.title)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      ptBR.description,
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ptBR.title)
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('auto')
    await expect(page.getByRole('toolbar', { name: ptBR.controls.label })).toBeVisible()
    const opener = page.getByRole('button', { name: ptBR.exhibit.about, exact: true })
    await opener.click()
    await expect(page.getByRole('dialog')).toHaveAccessibleName(ptBR.exhibit.about)
    for (const text of ['304,8 mm', '1,27 mm', '0,508 mm', '0,254 mm'])
      await expect(page.getByRole('dialog')).toContainText(text)
    await expect(page.getByRole('dialog')).toContainText(ptBR.about.instructions)
    await page.getByRole('button', { name: ptBR.details.close }).click()
    await expect(opener).toBeFocused()
    await expect(page.getByRole('button', { name: ptBR.controls.zoomIn })).toBeEnabled({
      timeout: 60_000,
    })
    // These markers live inside the independent Three.js renderer/context bridge.
    const marker = page.getByRole('button', {
      name: ptBR.details.explore(ptBR.inscriptions.playback.category),
      exact: true,
    })
    await marker.focus()
    await marker.press('Enter')
    for (const item of inscriptions) {
      const copy = ptBR.inscriptions[item.id]
      await expect(page.getByRole('dialog')).toHaveAccessibleName(copy.title)
      await expect(page.getByRole('dialog')).toContainText(copy.explanation)
      await expect(page.getByRole('img', { name: ptBR.details.image(copy.category) })).toBeVisible()
      await expect(
        page.getByRole('dialog').getByRole('button', { name: ptBR.details.inspect }),
      ).toHaveCount(0)
      await expect(page.locator('.detail-pagination')).toHaveCSS('border-top-width', '0px')
      await page.getByRole('button', { name: ptBR.details.next }).click()
    }
    await page.keyboard.press('Escape')
    expect(errors).toEqual([])
  })

  test('persists a manual choice and can return to automatic detection', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('The Golden Record')
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('combobox', { name: 'Language' }).selectOption('auto')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    expect(await page.evaluate(() => localStorage.getItem('voyager-language'))).toBeNull()
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ptBR.title)
  })

  test('detects and switches languages when storage is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.getItem = () => {
        throw new DOMException('Blocked', 'SecurityError')
      }
      Storage.prototype.setItem = () => {
        throw new DOMException('Blocked', 'SecurityError')
      }
      Storage.prototype.removeItem = () => {
        throw new DOMException('Blocked', 'SecurityError')
      }
    })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('combobox', { name: 'Language' }).selectOption('auto')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  })

  test('ignores an invalid saved language and follows browser changes only in automatic mode', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('voyager-language', 'obsolete'))
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'languages', {
        value: ['en-GB', 'pt-BR'],
        configurable: true,
      })
      window.dispatchEvent(new Event('languagechange'))
    })
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('combobox', { name: 'Language' }).selectOption('pt-BR')
    await page.evaluate(() => window.dispatchEvent(new Event('languagechange')))
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  })

  test('synchronizes explicit choices and automatic mode across tabs', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    const other = await context.newPage()
    await other.goto('/')
    await expect(other.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en')
    await expect(other.locator('html')).toHaveAttribute('lang', 'en')
    await expect(other.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
    await other.getByRole('combobox', { name: 'Language' }).selectOption('auto')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page.getByRole('combobox', { name: 'Idioma' })).toHaveValue('auto')
    await other.close()
  })

  test('falls back to navigator.language and localizes missing pages', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'languages', { value: [] }))
    await page.goto('/missing-page')
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ptBR.errors.notFound)
    await page.getByRole('link', { name: ptBR.errors.home }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ptBR.title)
  })

  test('localizes search, all recordings, playback errors and the compact player', async ({
    page,
  }) => {
    await page.route(archiveAudio, (route) => route.fulfill({ status: 503, body: 'Unavailable' }))
    await page.goto('/')
    await page.getByRole('switch', { name: ptBR.exhibit.showRecord }).setChecked(true)
    await page.locator('.listen-caption').click()
    await expect(page.getByRole('dialog')).toHaveAccessibleName(ptBR.music.title)
    await expect(page.locator('.music-track')).toHaveCount(27)
    await page.getByRole('searchbox', { name: ptBR.music.search }).fill('alemanha')
    await expect(page.locator('.music-track')).toHaveCount(5)
    await page.getByRole('searchbox').fill('estados unidos')
    await expect(page.locator('.music-track')).toHaveCount(4)
    await page.getByRole('searchbox').fill('nada corresponde')
    await expect(page.getByText(ptBR.music.empty, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: ptBR.music.clear, exact: true }).last().click()
    await page.getByRole('button', { name: 'Saudações e sons 4' }).click()
    await expect(page.locator('.music-track')).toHaveCount(4)
    await page.getByRole('button', { name: ptBR.music.play, exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(ptBR.music.failed)
    await expect(page.getByRole('button', { name: ptBR.music.retry })).toBeVisible()
    await page.locator('audio').evaluate((audio: HTMLAudioElement) => {
      Object.defineProperty(audio, 'error', { get: () => null })
      audio.play = () => Promise.reject(new DOMException('Playback denied', 'NotAllowedError'))
    })
    await page.getByRole('button', { name: ptBR.music.retry }).click()
    await expect(page.getByRole('alert')).toContainText(ptBR.music.blocked)

    await expect(page.locator('.now-playing')).toContainText('Saudação das Nações Unidas')
    await page.getByRole('button', { name: ptBR.music.close }).click()
    await expect(page.getByRole('complementary', { name: ptBR.music.nowPlaying })).toContainText(
      ptBR.music.unavailable,
    )
    await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en')
    await expect(page.locator('.mini-player')).toContainText('Recording unavailable')
    await expect(page.locator('.mini-player')).toContainText('Greeting from the United Nations')
    await page.getByRole('button', { name: 'Open music playlist' }).click()
    await expect(page.getByRole('alert')).toContainText('Press play to begin listening.')
  })

  test('keeps the picker next to the theme and the Portuguese mobile interface in bounds', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('/')
    const picker = page.getByRole('combobox', { name: 'Idioma' })
    await expect(picker).toBeEnabled()
    const theme = page.locator('.gallery-header nav .icon-button').last()
    const pickerBounds = (await picker.boundingBox())!
    const themeBounds = (await theme.boundingBox())!
    const title = (await page.getByRole('heading', { level: 1 }).boundingBox())!
    expect(pickerBounds.x).toBeGreaterThanOrEqual(themeBounds.x + themeBounds.width)
    expect(pickerBounds.y).toBe(themeBounds.y)
    expect(title.x + title.width).toBeLessThanOrEqual(themeBounds.x - 40)
    await picker.focus()
    await expect(picker).toBeFocused()
    await page.getByRole('switch', { name: ptBR.exhibit.showRecord }).setChecked(true)
    await page.locator('.listen-caption').click()
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(
        page.getByRole('button', { name: ptBR.music.play, exact: true }),
      ).toBeInViewport()
      await page.locator('.music-track').last().scrollIntoViewIfNeeded()
      await expect(page.locator('.music-track').last()).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
    await page.screenshot({ path: 'artifacts/i18n-pt-BR-mobile.png' })
  })

  test('translates the WebGL fallback and retains access to the playlist', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: ptBR.controls.zoomIn })).toBeEnabled({
      timeout: 60_000,
    })
    await page
      .locator('canvas')
      .evaluate((canvas) =>
        canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
      )
    await expect(page.locator('.webgl-fallback')).toContainText(ptBR.exhibit.fallback)
    await expect(page.getByRole('img', { name: ptBR.exhibit.coverPhoto })).toBeVisible()
    await page.getByRole('switch', { name: ptBR.exhibit.showRecord }).setChecked(true)
    await expect(page.getByRole('img', { name: ptBR.exhibit.recordPhoto })).toBeVisible()
    await page.locator('.listen-caption').click()
    await expect(page.locator('.music-track')).toHaveCount(27)
  })
})

for (const [locale, expected] of [
  ['pt-PT', 'pt-BR'],
  ['fr-FR', 'en'],
  ['en-GB', 'en'],
] as const) {
  test.describe(`browser locale ${locale}`, () => {
    test.use({ locale })
    test(`resolves to ${expected}`, async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('lang', expected)
      await expect(page.getByRole('combobox')).toBeEnabled()
    })
  })
}
