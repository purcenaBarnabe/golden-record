import { expect, test } from '@playwright/test'
import { en } from '../../src/lib/i18n/en'
import { ptBR } from '../../src/lib/i18n/pt-BR'
import { PREVIEW_IMAGE, SITE_URL, SOURCE_URL } from '../../src/lib/seo'

function pngSize(data: Buffer) {
  expect(data.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
}

test.describe('crawler and link preview support', () => {
  test.use({ javaScriptEnabled: false })

  test('serves complete social metadata, structured data and assets without JavaScript', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(en.seo.title)
    await expect(page.locator('head title')).toHaveCount(1)
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', SITE_URL)
    await expect(page.locator('meta[name="description"]')).toHaveCount(1)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      en.description,
    )
    for (const property of [
      'og:title',
      'og:description',
      'og:type',
      'og:locale',
      'og:locale:alternate',
      'og:site_name',
      'og:image:alt',
    ]) {
      await expect(page.locator(`meta[property="${property}"]`)).toHaveCount(1)
      await expect(page.locator(`meta[property="${property}"]`)).not.toHaveAttribute('content', '')
    }
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', SITE_URL)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      PREVIEW_IMAGE,
    )
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    )
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      PREVIEW_IMAGE,
    )
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      en.seo.title,
    )
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /max-image-preview:large/,
    )
    const graph = JSON.parse((await page.locator('#exhibit-structured-data').textContent())!)[
      '@graph'
    ]
    expect(graph.find((entry: { '@type': string }) => entry['@type'] === 'WebPage')).toMatchObject({
      url: SITE_URL,
      name: en.seo.title,
      inLanguage: 'en',
      primaryImageOfPage: { url: PREVIEW_IMAGE, width: 1200, height: 630 },
    })
    const card = await request.get(new URL(PREVIEW_IMAGE).pathname)
    expect(card.ok()).toBe(true)
    expect(card.headers()['content-type']).toContain('image/png')
    const metadata = pngSize(await card.body())
    expect(metadata).toMatchObject({ width: 1200, height: 630 })
    for (const [rel, size] of [
      ['icon', 48],
      ['apple-touch-icon', 180],
    ] as const) {
      const href = await page
        .locator(`link[rel="${rel}"][sizes="${size}x${size}"]`)
        .getAttribute('href')
      const response = await request.get(href!)
      expect(response.ok()).toBe(true)
      expect(pngSize(await response.body())).toMatchObject({
        width: size,
        height: size,
      })
    }
    const robots = await request.get('/robots.txt')
    expect(robots.ok()).toBe(true)
    expect(await robots.text()).toContain(`Sitemap: ${SITE_URL}sitemap.xml`)
    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.ok()).toBe(true)
    expect(sitemap.headers()['content-type']).toMatch(/xml/)
    expect(await sitemap.text()).toContain(`<loc>${SITE_URL}</loc>`)
  })
})

test('keeps social/search metadata in sync when switching languages', async ({ page }) => {
  await page.goto('/')
  for (const [locale, messages, ogLocale, alternate] of [
    ['pt-BR', ptBR, 'pt_BR', 'en_US'],
    ['en', en, 'en_US', 'pt_BR'],
  ] as const) {
    await page.getByRole('combobox').selectOption(locale)
    await expect(page).toHaveTitle(messages.seo.title)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      messages.description,
    )
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      messages.seo.title,
    )
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      messages.seo.title,
    )
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      messages.description,
    )
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      'content',
      messages.description,
    )
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', ogLocale)
    await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
      'content',
      alternate,
    )
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      messages.seo.imageAlt,
    )
    await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
      'content',
      messages.seo.imageAlt,
    )
    const graph = JSON.parse((await page.locator('#exhibit-structured-data').textContent())!)[
      '@graph'
    ]
    expect(graph.find((entry: { '@type': string }) => entry['@type'] === 'WebPage')).toMatchObject({
      name: messages.seo.title,
      inLanguage: locale,
    })
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', SITE_URL)
  }
})

test('credits link directly to the original references and project source', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'About this recreation', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Source code · GitHub' })).toHaveAttribute(
    'href',
    SOURCE_URL,
  )
  const links = await page
    .getByRole('dialog')
    .locator('a')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        href: element.getAttribute('href'),
        target: element.getAttribute('target'),
        rel: element.getAttribute('rel'),
      })),
    )
  expect(links).toHaveLength(6)
  for (const link of links) {
    expect(new URL(link.href!).protocol).toBe('https:')
    expect(link.target).toBe('_blank')
    expect(link.rel?.split(' ')).toEqual(expect.arrayContaining(['noopener', 'noreferrer']))
  }
})
