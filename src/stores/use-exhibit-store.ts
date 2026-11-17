import { create } from 'zustand'
import type { InscriptionId } from '../lib/inscriptions'
import { clampZoom, ENGRAVING_ZOOM, TEXTURE_ZOOM } from '../lib/inspection'

export type Artifact = 'cover' | 'record'
export type Lighting = 'gallery' | 'raking'
export type HoverTarget = InscriptionId | 'music'
export interface SurfaceHoverPoint {
  x: number
  y: number
  artwork?: [number, number]
}
let hoverLeaveTimer: ReturnType<typeof setTimeout> | undefined
function cancelHoverLeave() {
  clearTimeout(hoverLeaveTimer)
  hoverLeaveTimer = undefined
}
function dismissHover() {
  cancelHoverLeave()
  return { hovered: null, annotationHovered: null, surfaceHoverPoint: null }
}
interface ExhibitState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  artifact: Artifact
  annotations: boolean
  lighting: Lighting
  selected: InscriptionId | null
  hovered: HoverTarget | null
  annotationHovered: HoverTarget | null
  surfaceHoverPoint: SurfaceHoverPoint | null
  focus: InscriptionId | 'cover-texture' | 'record-texture' | null
  panel: 'sources' | 'music' | null
  view: 'front' | 'back'
  viewRevision: number
  zoom: number
  zoomRevision: number
  setArtifact: (artifact: Artifact) => void
  syncArtifact: (artifact: Artifact) => void
  setSelected: (selected: InscriptionId | null) => void
  setHovered: (hovered: HoverTarget | null, point?: SurfaceHoverPoint) => void
  setAnnotationHovered: (hovered: HoverTarget | null) => void
  clearHover: () => void
  inspectEngraving: (id: InscriptionId) => void
  inspectTexture: () => void
  setPanel: (panel: ExhibitState['panel']) => void
  toggleAnnotations: () => void
  toggleLighting: () => void
  changeZoom: (delta: number) => void
  syncZoom: (zoom: number) => void
  reset: () => void
}

export const useExhibitStore = create<ExhibitState>((set, get) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  artifact: 'cover',
  annotations: false,
  lighting: 'gallery',
  selected: null,
  hovered: null,
  annotationHovered: null,
  surfaceHoverPoint: null,
  focus: null,
  panel: null,
  view: 'front',
  viewRevision: 0,
  zoom: 1,
  zoomRevision: 0,
  setArtifact: (artifact) =>
    set((s) => ({
      ...dismissHover(),
      artifact,
      focus: null,
      zoom: 1,
      selected: null,
      view: artifact === 'cover' ? 'front' : 'back',
      viewRevision: s.viewRevision + 1,
    })),
  syncArtifact: (artifact) => {
    if (get().artifact !== artifact)
      set({ artifact, view: artifact === 'cover' ? 'front' : 'back' })
  },
  setSelected: (selected) =>
    set((s) => ({
      ...dismissHover(),
      selected,
      panel: null,
      artifact: selected ? 'cover' : s.artifact,
      view: selected ? 'front' : s.view,
      viewRevision: selected && s.view !== 'front' ? s.viewRevision + 1 : s.viewRevision,
    })),
  setHovered: (hovered, point) => {
    // A DOM card owns hover until the pointer/focus leaves it. Canvas events
    // bubbling underneath it must never replace the active inscription.
    if (get().annotationHovered) return
    if (!hovered) {
      // Continued movement across blank metal must not postpone dismissal.
      if (!get().hovered || hoverLeaveTimer !== undefined) return
      hoverLeaveTimer = setTimeout(() => {
        hoverLeaveTimer = undefined
        if (!get().annotationHovered) set({ hovered: null, surfaceHoverPoint: null })
      }, 180)
      return
    }
    cancelHoverLeave()
    if (get().hovered === hovered) return
    set({ hovered, surfaceHoverPoint: point ?? null })
  },
  setAnnotationHovered: (annotationHovered) => {
    cancelHoverLeave()
    if (
      annotationHovered &&
      get().annotationHovered === annotationHovered &&
      get().hovered === annotationHovered
    )
      return
    if (annotationHovered)
      set({
        annotationHovered,
        hovered: annotationHovered,
        surfaceHoverPoint: get().hovered === annotationHovered ? get().surfaceHoverPoint : null,
      })
    else {
      set({ annotationHovered: null })
      hoverLeaveTimer = setTimeout(() => {
        hoverLeaveTimer = undefined
        if (!get().annotationHovered) set({ hovered: null, surfaceHoverPoint: null })
      }, 180)
    }
  },
  clearHover: () => set(dismissHover()),
  inspectEngraving: (focus) =>
    set((s) => ({
      ...dismissHover(),
      focus,
      artifact: 'cover',
      view: 'front',
      zoom: ENGRAVING_ZOOM,
      selected: null,
      panel: null,
      viewRevision: s.viewRevision + 1,
    })),
  inspectTexture: () =>
    set((s) => ({
      ...dismissHover(),
      focus: `${s.artifact}-texture`,
      view: s.artifact === 'cover' ? 'front' : 'back',
      zoom: TEXTURE_ZOOM,
      lighting: 'raking',
      selected: null,
      panel: null,
      viewRevision: s.viewRevision + 1,
    })),
  setPanel: (panel) => set({ ...dismissHover(), panel, selected: null }),
  toggleAnnotations: () => set((s) => ({ ...dismissHover(), annotations: !s.annotations })),
  toggleLighting: () => set((s) => ({ lighting: s.lighting === 'gallery' ? 'raking' : 'gallery' })),
  changeZoom: (delta) =>
    set((s) => ({
      ...dismissHover(),
      zoom: clampZoom(delta > 0 ? s.zoom * 1.25 : s.zoom / 1.25),
      zoomRevision: s.zoomRevision + 1,
    })),
  syncZoom: (zoom) => {
    const next = clampZoom(zoom)
    if (get().zoom !== next) set({ zoom: next })
  },
  reset: () =>
    set((s) => ({
      ...dismissHover(),
      zoom: 1,
      focus: null,
      view: s.artifact === 'cover' ? 'front' : 'back',
      selected: null,
      viewRevision: s.viewRevision + 1,
    })),
}))
