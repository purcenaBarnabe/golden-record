import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/react'
import { beginOperation, reportFailure, trackInteraction } from '../../src/lib/observability'
import { observeExhibit } from '../../src/lib/exhibit-observability'
import { useExhibitStore } from '../../src/stores/use-exhibit-store'

vi.mock('@sentry/react', () => ({
  getClient: vi.fn(() => ({})),
  addBreadcrumb: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  metrics: { count: vi.fn(), distribution: vi.fn() },
  captureException: vi.fn(),
  startInactiveSpan: vi.fn(() => ({
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('window', {})
  useExhibitStore.setState(useExhibitStore.getInitialState())
})
afterEach(() => vi.unstubAllGlobals())

describe('exhibit observability', () => {
  it('reports committed interactions without recording pointer motion or camera zoom updates', () => {
    const stop = observeExhibit()
    const state = useExhibitStore.getState()
    state.setArtifact('record')
    state.setArtifact('record')
    state.syncZoom(2)
    state.syncZoom(3)
    state.setHovered('music', { x: 100, y: 100 })
    state.setAnnotationHovered('music')
    state.setPanel('music')
    state.setPanel(null)
    stop()
    expect(vi.mocked(Sentry.addBreadcrumb).mock.calls.map(([entry]) => entry.message)).toEqual([
      'artifact.changed',
      'panel.opened',
      'panel.closed',
    ])
    state.setArtifact('cover')
    expect(Sentry.addBreadcrumb).toHaveBeenCalledTimes(3)
  })

  it('preserves card identity when moving through engraving details', () => {
    const stop = observeExhibit()
    const ids = ['playback', 'hydrogen'] as const
    for (const id of ids) useExhibitStore.getState().setSelected(id)
    useExhibitStore.getState().setSelected(null)
    stop()
    expect(
      vi.mocked(Sentry.addBreadcrumb).mock.calls.map(([entry]) => [entry.message, entry.data]),
    ).toEqual([
      ['infocard.opened', { inscription: 'playback' }],
      ['infocard.closed', { inscription: 'playback' }],
      ['infocard.opened', { inscription: 'hydrogen' }],
      ['infocard.closed', { inscription: 'hydrogen' }],
    ])
  })

  it('finishes asynchronous work once even if multiple media events settle it', () => {
    const finish = beginOperation('audio.startup', { track_id: 1 })
    const span = vi.mocked(Sentry.startInactiveSpan).mock.results[0].value
    finish('error')
    finish('ok')
    expect(span.end).toHaveBeenCalledOnce()
    expect(span.setStatus).toHaveBeenCalledWith({ code: 2, message: 'internal_error' })
    expect(Sentry.metrics.distribution).toHaveBeenCalledExactlyOnceWith(
      'exhibit.audio.startup.duration',
      expect.any(Number),
      { unit: 'millisecond', attributes: { track_id: 1, outcome: 'error' } },
    )
  })

  it('does not send telemetry while prerendering or when no client is configured', () => {
    vi.stubGlobal('window', undefined)
    trackInteraction('panel.opened', { panel: 'music' })
    reportFailure(new Error('server render'), 'scene')
    beginOperation('scene.load')('ok')
    vi.stubGlobal('window', {})
    vi.mocked(Sentry.getClient).mockReturnValueOnce(undefined)
    trackInteraction('panel.opened')
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(Sentry.startInactiveSpan).not.toHaveBeenCalled()
  })
})
