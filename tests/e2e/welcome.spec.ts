import { expect, test, type Page } from '@playwright/test'
import { ptBR } from '../../src/lib/i18n/pt-BR'
import { COVER_RELIEF_URL } from '../../src/lib/exhibit-assets'

const welcome = (page: Page) => page.locator('.welcome-celebration')

async function holdRecordLoading(page: Page) {
  let resume!: () => void
  const pending = new Promise<void>((resolve) => {
    resume = resolve
  })
  await page.route(`**${COVER_RELIEF_URL}`, async (route) => {
    await pending
    await route.continue()
  })
  return resume
}

test('welcomes a first visitor, closes accessibly, and stays dismissed across visits and tabs', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(welcome(page)).toBeVisible({ timeout: 60_000 })
  await expect(
    page.getByRole('img', { name: 'Voyager spacecraft wearing a pink party hat' }),
  ).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('voyager-welcome-seen'))).toBe('true')
  await expect(welcome(page).locator('.welcome-confetti i')).toHaveCount(36)
  // The celebration adds no canvas and never steals keyboard focus.
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(1)
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  await expect(welcome(page).getByRole('heading')).toHaveText('Congrats, Voyager 1!')
  await expect(welcome(page)).toContainText('One light-day from Earth.')
  const source = welcome(page).getByRole('link', { name: 'Track Voyager on NASA' })
  await expect(source).toHaveAttribute(
    'href',
    'https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/',
  )
  await expect(source).toHaveAttribute('target', '_blank')
  await source.click({ trial: true })

  const close = page.getByRole('button', { name: 'Close celebration' })
  await close.focus()
  await close.press('Enter')
  await expect(welcome(page)).toHaveCount(0)
  await expect(page.locator('#viewer-controls')).toBeFocused()

  await page.reload()
  await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false', {
    timeout: 60_000,
  })
  await expect(welcome(page)).toHaveCount(0)
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.locator('#artifact')).toHaveAttribute('aria-busy', 'false', {
    timeout: 60_000,
  })
  await expect(welcome(other)).toHaveCount(0)
  await other.close()
})

test('stops its animations and times out without waiting for the 3D record', async ({ page }) => {
  const resume = await holdRecordLoading(page)
  const requested = page.waitForRequest(`**${COVER_RELIEF_URL}`)
  try {
    await page.goto('/')
    await expect(welcome(page)).toBeVisible()
    await requested
    await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByText('Preparing the record')).toBeHidden()
    // All movement finishes before the overlay's independent dismissal timeout.
    await expect
      .poll(
        () =>
          welcome(page).evaluate(
            (element) =>
              element
                .getAnimations({ subtree: true })
                .filter((item) => item.playState === 'running').length,
          ),
        { timeout: 8000 },
      )
      .toBe(0)
    await expect(welcome(page)).toBeVisible()
    await expect(welcome(page)).toHaveCount(0, { timeout: 8000 })
    await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByText('Preparing the record')).toBeVisible()
    resume()
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled({
      timeout: 60_000,
    })
    await expect(welcome(page)).toHaveCount(0)
  } finally {
    resume()
  }
})

for (const action of ['Escape', 'Let’s explore', 'Close celebration'] as const) {
  test(`dismisses with ${action} before the record finishes loading`, async ({ page }) => {
    const resume = await holdRecordLoading(page)
    try {
      await page.goto('/')
      await expect(welcome(page)).toBeVisible()
      await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'true')
      if (action === 'Escape') await page.keyboard.press('Escape')
      else await page.getByRole('button', { name: action }).click()
      await expect(welcome(page)).toHaveCount(0)
      await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'true')
      resume()
      await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'false', {
        timeout: 60_000,
      })
      await expect(welcome(page)).toHaveCount(0)
    } finally {
      resume()
    }
  })
}

test.describe('first visit on a phone with a slow record download', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('celebrates immediately while the record loads and becomes interactive behind it', async ({
    page,
  }) => {
    const resume = await holdRecordLoading(page)
    const requested = page.waitForRequest(`**${COVER_RELIEF_URL}`)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    try {
      await page.goto('/')
      await expect(welcome(page)).toBeVisible()
      await requested
      await expect(page.locator('#artifact')).toHaveAttribute('aria-busy', 'true')
      await expect(page.getByText('Preparing the record')).toBeHidden()
      await expect(
        page.getByRole('img', { name: 'Voyager spacecraft wearing a pink party hat' }),
      ).toBeVisible()
      await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled()
      expect(await page.evaluate(() => localStorage.getItem('voyager-welcome-seen'))).toBe('true')
      resume()
      await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled({
        timeout: 60_000,
      })
      await expect(welcome(page)).toBeVisible()
      await expect(page.getByText('Preparing the record')).toHaveCount(0)
      await page.getByRole('button', { name: 'Close celebration' }).tap()
      await expect(welcome(page)).toHaveCount(0)
      expect(errors).toEqual([])
    } finally {
      resume()
    }
  })
})

for (const blocked of ['read', 'write'] as const) {
  test(`storage ${blocked} failures keep the welcome and underlying exhibit usable`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((operation) => {
      Storage.prototype[operation === 'read' ? 'getItem' : 'setItem'] = () => {
        throw new DOMException('Storage unavailable', 'SecurityError')
      }
    }, blocked)
    await page.goto('/')
    await expect(welcome(page)).toBeVisible({ timeout: 60_000 })
    // A click goes through the overlay and dismisses it without swallowing the action.
    await page.getByRole('button', { name: 'About this recreation' }).click()
    await expect(page.getByRole('dialog', { name: 'About this recreation' })).toBeVisible()
    await expect(welcome(page)).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test.describe('a quiet, localized welcome on small screens', () => {
  test.use({ locale: 'pt-BR', colorScheme: 'dark', reducedMotion: 'reduce' })

  test('respects reduced motion and fits portrait and landscape viewports', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('/')
    await expect(welcome(page)).toBeVisible({ timeout: 60_000 })
    await expect(welcome(page).getByRole('heading')).toHaveText(ptBR.welcome.title)
    await expect(page.getByRole('img', { name: ptBR.welcome.voyager })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.welcome-confetti')).toBeHidden()
    await expect(page.locator('.welcome-voyager')).toHaveCSS('animation-name', 'none')
    await expect(welcome(page)).toHaveCSS('animation-name', 'none')
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(page.getByRole('button', { name: ptBR.welcome.close })).toBeInViewport()
      await expect(page.getByRole('button', { name: ptBR.welcome.explore })).toBeInViewport()
      await expect(page.getByRole('link', { name: ptBR.welcome.source })).toBeInViewport()
      await expect(page.getByRole('img', { name: ptBR.welcome.voyager })).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
    }
    await page.getByRole('button', { name: ptBR.welcome.explore }).click()
    await expect(welcome(page)).toHaveCount(0)
  })
})
