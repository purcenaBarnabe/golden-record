import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/instrument-serif/400.css'
import '../styles/globals.css'
import { reportFailure } from '../lib/observability'

export const Route = createRootRoute({
  onCatch: (error) => reportFailure(error, 'router'),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'The Golden Record' },
      {
        name: 'description',
        content:
          'Voyager’s Golden Record, exhibited on a pedestal. Orbit the artifact, inspect its metal surfaces, and explore its engraved instructions.',
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
    <html lang="en">
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
