import * as Sentry from '@sentry/react'

export type ObservationAttributes = Record<string, string | number | boolean>
export type OperationOutcome = 'ok' | 'error' | 'cancelled'

const enabled = () => typeof window !== 'undefined' && Boolean(Sentry.getClient())

/** Deliberate actions only: never pointer moves, animation frames, or search text. */
export function trackInteraction(action: string, attributes: ObservationAttributes = {}) {
  if (!enabled()) return
  Sentry.addBreadcrumb({ category: 'exhibit', message: action, level: 'info', data: attributes })
  Sentry.metrics.count('exhibit.interactions', 1, { attributes: { action, ...attributes } })
  Sentry.logger.info(action, attributes)
}

export function reportFailure(
  error: unknown,
  feature: string,
  attributes: ObservationAttributes = {},
) {
  if (!enabled()) return
  Sentry.metrics.count('exhibit.failures', 1, { attributes: { feature, ...attributes } })
  Sentry.logger.error(`${feature}.failed`, attributes)
  Sentry.captureException(error, { tags: { feature }, contexts: { exhibit: attributes } })
}

/** A span and an unsampled metric for asynchronous work, finished at most once. */
export function beginOperation(
  name: string,
  attributes: ObservationAttributes = {},
  startedAt = typeof performance === 'undefined' ? 0 : performance.now(),
) {
  if (!enabled()) return (_outcome: OperationOutcome = 'ok') => {}
  const span = Sentry.startInactiveSpan({
    name,
    op: name.startsWith('audio.') ? 'media' : 'ui.exhibit',
    forceTransaction: true,
    parentSpan: null,
    startTime: (performance.timeOrigin + startedAt) / 1000,
    attributes,
  })
  let finished = false
  return (outcome: OperationOutcome = 'ok') => {
    if (finished) return
    finished = true
    span.setAttribute('outcome', outcome)
    span.setStatus(
      outcome === 'ok'
        ? { code: 1 }
        : {
            code: 2,
            message: outcome === 'error' ? 'internal_error' : 'cancelled',
          },
    )
    span.end()
    Sentry.metrics.distribution(`exhibit.${name}.duration`, performance.now() - startedAt, {
      unit: 'millisecond',
      attributes: { ...attributes, outcome },
    })
  }
}

let finishScene: ReturnType<typeof beginOperation> | undefined
export function startSceneObservation() {
  finishScene = beginOperation('scene.load', {}, 0)
}

export function finishSceneObservation(outcome: 'ok' | 'error') {
  if (!finishScene) return
  finishScene(outcome)
  finishScene = undefined
  trackInteraction(outcome === 'ok' ? 'scene.ready' : 'scene.fallback')
}
