import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import * as Sentry from '@sentry/react'

export function getRouter() {
  const router = createRouter({ routeTree, scrollRestoration: true })
  if (typeof window !== 'undefined' && Sentry.getClient())
    Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router))
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
