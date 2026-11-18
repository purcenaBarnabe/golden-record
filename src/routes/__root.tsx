import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/instrument-serif/400.css'
import '../styles/globals.css'
import { reportFailure } from '../lib/observability'
import { LocaleProvider, useI18n } from '../lib/i18n'
import { seoMeta, serializedStructuredData, SITE_URL } from '../lib/seo'

export const Route = createRootRoute({
  onCatch: (error) => reportFailure(error, 'router'),
  errorComponent: ({ reset }) => <RouteMessage reset={reset} />,
  notFoundComponent: () => <RouteMessage />,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ...seoMeta('en'),
      { name: 'theme-color', content: '#ffffff' },
    ],
    links: [
      { rel: 'canonical', href: SITE_URL },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    ],
  }),
  component: Outlet,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <LocalizedDocument>{children}</LocalizedDocument>
    </LocaleProvider>
  )
}

function LocalizedDocument({ children }: { children: ReactNode }) {
  const { locale } = useI18n()
  useEffect(() => {
    for (const meta of seoMeta(locale)) {
      if (meta.title) document.title = meta.title
      else {
        const selector = meta.property
          ? `meta[property="${meta.property}"]`
          : `meta[name="${meta.name}"]`
        document.querySelector(selector)?.setAttribute('content', meta.content!)
      }
    }
  }, [locale])
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
        <script
          id="exhibit-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializedStructuredData(locale) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RouteMessage({ reset }: { reset?: () => void }) {
  const { t } = useI18n()
  return (
    <main className="route-message">
      <h1>{reset ? t.errors.title : t.errors.notFound}</h1>
      {reset && <p>{t.errors.description}</p>}
      {reset ? <button onClick={reset}>{t.errors.retry}</button> : <a href="/">{t.errors.home}</a>}
    </main>
  )
}
