import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM } from '../../src/lib/inspection'
import { useExhibitStore } from '../../src/stores/use-exhibit-store'

const state = () => useExhibitStore.getState()
beforeEach(() => {
  vi.useFakeTimers()
  state().reset()
})
afterEach(() => {
  state().clearHover()
  vi.useRealTimers()
})

describe('Inscription hover ownership', () => {
  it('dismisses on time while the pointer keeps moving across empty metal', () => {
    state().setHovered('playback')
    state().setHovered(null)
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(40)
      state().setHovered(null)
    }
    expect(state().hovered).toBeNull()
  })
  it('retains the surface entry point while approaching a card and releases it on dismissal', () => {
    state().setHovered('pulsars', { x: 100, y: 200 })
    state().setHovered('pulsars', { x: 105, y: 210 })
    expect(state().surfaceHoverPoint).toEqual({ x: 100, y: 200 })
    state().setAnnotationHovered('pulsars')
    expect(state().surfaceHoverPoint).toEqual({ x: 100, y: 200 })
    state().clearHover()
    expect(state().surfaceHoverPoint).toBeNull()
  })
  it('keeps the same card while canvas events hit other figures underneath it', () => {
    state().setHovered('hydrogen')
    state().setAnnotationHovered('hydrogen')
    state().setHovered('pulsars')
    state().setHovered(null)
    vi.advanceTimersByTime(1000)
    expect(state().hovered).toBe('hydrogen')
    state().setAnnotationHovered(null)
    vi.advanceTimersByTime(181)
    expect(state().hovered).toBeNull()
  })
  it('cancels a pending surface leave when the pointer enters the card', () => {
    state().setHovered('playback')
    state().setHovered(null)
    vi.advanceTimersByTime(100)
    state().setAnnotationHovered('playback')
    vi.advanceTimersByTime(1000)
    expect(state().hovered).toBe('playback')
  })
  it('allows direct movement to another card and clears ownership on reset', () => {
    state().setAnnotationHovered('pulsars')
    state().setAnnotationHovered(null)
    state().setAnnotationHovered('hydrogen')
    vi.advanceTimersByTime(1000)
    expect(state().hovered).toBe('hydrogen')
    state().reset()
    expect(state().annotationHovered).toBeNull()
    state().setHovered('scan')
    expect(state().hovered).toBe('scan')
  })
})

describe('Macro inspection', () => {
  it('focuses the chosen engraving and closes cards and panels', () => {
    state().setSelected('hydrogen')
    state().inspectEngraving('hydrogen')
    expect(state()).toMatchObject({
      focus: 'hydrogen',
      zoom: 18,
      artifact: 'cover',
      view: 'front',
      selected: null,
      panel: null,
      hovered: null,
    })
    state().reset()
    expect(state()).toMatchObject({ focus: null, zoom: 1 })
  })
  it('allows wheel and button zoom to share the full inspection range', () => {
    for (let i = 0; i < 25; i++) state().changeZoom(0.25)
    expect(state().zoom).toBe(MAX_ZOOM)
    state().syncZoom(18)
    state().changeZoom(0.25)
    expect(state().zoom).toBe(22.5)
    for (let i = 0; i < 30; i++) state().changeZoom(-0.25)
    expect(state().zoom).toBe(MIN_ZOOM)
  })
})

describe('Reviewed interaction behavior', () => {
  it('does not publish identical hover states on every pointer movement', () => {
    state().setHovered('playback')
    const previous = state()
    state().setHovered('playback')
    expect(state()).toBe(previous)
  })
  it('tracks manual rotation without scheduling another camera animation', () => {
    const revision = state().viewRevision
    state().syncArtifact('record')
    expect(state()).toMatchObject({ artifact: 'record', view: 'back', viewRevision: revision })
    state().setSelected('hydrogen')
    expect(state().viewRevision).toBe(revision + 1)
  })
  it('opens the music window and releases surface hover ownership', () => {
    state().setAnnotationHovered('music')
    state().setPanel('music')
    expect(state()).toMatchObject({
      panel: 'music',
      hovered: null,
      annotationHovered: null,
      selected: null,
    })
    state().setPanel(null)
  })
})
