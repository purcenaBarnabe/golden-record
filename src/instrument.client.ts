import * as Sentry from '@sentry/react'
import { startSceneObservation } from './lib/observability'
import { useExhibitStore } from './stores/use-exhibit-store'

const dsn = import.meta.env.VITE_SENTRY_DSN
const configuredRate = import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE
const defaultRate = import.meta.env.PROD ? 0.1 : 1
const traceRate =
  configuredRate === undefined || configuredRate === '' ? defaultRate : Number(configuredRate)

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate:
      Number.isFinite(traceRate) && traceRate >= 0 && traceRate <= 1 ? traceRate : defaultRate,
    tracePropagationTargets: [],
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category === 'ui.input' || breadcrumb.category === 'console' ? null : breadcrumb,
    beforeSend: (event) => {
      const state = useExhibitStore.getState()
      event.contexts = {
        ...event.contexts,
        exhibit: {
          artifact: state.artifact,
          theme: state.theme,
          lighting: state.lighting,
          zoom: Math.round(state.zoom),
          inscription: state.selected,
          panel: state.panel,
          ...event.contexts?.exhibit,
        },
      }
      return event
    },
  })
  startSceneObservation()
}
