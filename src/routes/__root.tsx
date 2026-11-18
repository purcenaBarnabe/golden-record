import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/instrument-serif/400.css'
import '../styles/globals.css'
import { reportFailure } from '../lib/observability'
import { LocaleProvider, useI18n } from '../lib/i18n'
import { en } from '../lib/i18n/en'

export const Route = createRootRoute({
  onCatch: (error) => reportFailure(error, 'router'),
  errorComponent: ({ reset }) => <RouteMessage reset={reset} />,
  notFoundComponent: () => <RouteMessage />,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: en.title },
      {
        name: 'description',
        content: en.description,
      },
      { name: 'theme-color', content: '#ffffff' },
    ],
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
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
  const { locale, t } = useI18n()
  useEffect(() => {
    document.title = t.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.description)
  }, [t])
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
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
