import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, TEXTURE_ZOOM } from '../../src/lib/inspection'
import { METAL_FINISH, createMetalMaterial } from '../../src/lib/metal-finish'
import { useExhibitStore } from '../../src/stores/use-exhibit-store'

describe('Microscopic surface inspection', () => {
  it('keeps plating detail finer and shallower than the record spiral', () => {
    expect(METAL_FINISH.finePitch).toBeLessThan(METAL_FINISH.grainPitch)
    expect(METAL_FINISH.grainPitch).toBeLessThan(METAL_FINISH.groovePitch)
    expect(METAL_FINISH.grainHeight).toBeLessThan(METAL_FINISH.grainPitch / 20)
    expect(TEXTURE_ZOOM).toBeLessThan(MAX_ZOOM)
  })
  it('opens a 96× texture study on the currently visible surface', () => {
    const store = useExhibitStore.getState()
    store.setArtifact('record')
    store.inspectTexture()
    expect(useExhibitStore.getState()).toMatchObject({
      focus: 'record-texture',
      artifact: 'record',
      zoom: 96,
      lighting: 'raking',
      hovered: null,
    })
    useExhibitStore.getState().reset()
    useExhibitStore.getState().setArtifact('cover')
  })
  it('keeps shader variants distinct for the cover and grooved record', () => {
    const cover = createMetalMaterial({ metalness: 1 })
    const record = createMetalMaterial({ metalness: 1 }, 'record')
    expect(cover.customProgramCacheKey()).not.toBe(record.customProgramCacheKey())
    cover.dispose()
    record.dispose()
  })
})
