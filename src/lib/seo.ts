import { en } from './i18n/en'
import { ptBR } from './i18n/pt-BR'
import type { Locale } from './i18n/locale'
import { NASA_OVERVIEW } from './inscriptions'

export const SITE_URL = 'https://golden-record.purcena.com/'
export const SOURCE_URL = 'https://github.com/purcenaBarnabe/golden-record'
export const PREVIEW_IMAGE = new URL('social-preview.png', SITE_URL).href
export const PREVIEW_WIDTH = 1200
export const PREVIEW_HEIGHT = 630
const messages = { en, 'pt-BR': ptBR }
const ogLocales = { en: 'en_US', 'pt-BR': 'pt_BR' }

export function seoMeta(locale: Locale) {
  const t = messages[locale]
  return [
    { title: t.seo.title },
    { name: 'description', content: t.description },
    { name: 'application-name', content: t.title },
    { name: 'robots', content: 'index, follow, max-image-preview:large' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: SITE_URL },
    { property: 'og:site_name', content: t.title },
    { property: 'og:title', content: t.seo.title },
    { property: 'og:description', content: t.description },
    { property: 'og:locale', content: ogLocales[locale] },
    { property: 'og:locale:alternate', content: ogLocales[locale === 'en' ? 'pt-BR' : 'en'] },
    { property: 'og:image', content: PREVIEW_IMAGE },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:image:width', content: String(PREVIEW_WIDTH) },
    { property: 'og:image:height', content: String(PREVIEW_HEIGHT) },
    { property: 'og:image:alt', content: t.seo.imageAlt },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: t.seo.title },
    { name: 'twitter:description', content: t.description },
    { name: 'twitter:image', content: PREVIEW_IMAGE },
    { name: 'twitter:image:alt', content: t.seo.imageAlt },
  ]
}

export function structuredData(locale: Locale) {
  const t = messages[locale]
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}#website`,
        url: SITE_URL,
        name: t.title,
        description: t.description,
        inLanguage: ['en', 'pt-BR'],
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}#webpage`,
        url: SITE_URL,
        name: t.seo.title,
        description: t.description,
        inLanguage: locale,
        isPartOf: { '@id': `${SITE_URL}#website` },
        about: { '@type': 'Thing', name: 'Voyager Golden Record', sameAs: NASA_OVERVIEW },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: PREVIEW_IMAGE,
          contentUrl: PREVIEW_IMAGE,
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          caption: t.seo.imageAlt,
          creditText: 'Reference photography: NASA/JPL-Caltech.',
        },
      },
    ],
  }
}

export const serializedStructuredData = (locale: Locale) =>
  JSON.stringify(structuredData(locale)).replace(/</g, '\\u003c')
