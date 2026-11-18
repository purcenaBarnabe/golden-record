import { useExhibitStore } from '../stores/use-exhibit-store'
import { trackInteraction } from './observability'

/** Observe committed state changes once, including keyboard and touch actions. */
export function observeExhibit() {
  return useExhibitStore.subscribe((state, previous) => {
    if (state.artifact !== previous.artifact)
      trackInteraction('artifact.changed', { artifact: state.artifact })
    if (state.selected !== previous.selected) {
      if (previous.selected) trackInteraction('infocard.closed', { inscription: previous.selected })
      if (state.selected) trackInteraction('infocard.opened', { inscription: state.selected })
    }
    if (state.panel !== previous.panel) {
      if (previous.panel) trackInteraction('panel.closed', { panel: previous.panel })
      if (state.panel) trackInteraction('panel.opened', { panel: state.panel })
    }
    if (state.focus && state.viewRevision !== previous.viewRevision)
      trackInteraction('artifact.inspected', { target: state.focus, zoom: state.zoom })
    if (state.theme !== previous.theme) trackInteraction('theme.changed', { theme: state.theme })
    if (state.lighting !== previous.lighting)
      trackInteraction('lighting.changed', { lighting: state.lighting })
    if (state.mobileNavigationMode !== previous.mobileNavigationMode)
      trackInteraction('navigation.changed', { mode: state.mobileNavigationMode })
    if (state.zoomRevision !== previous.zoomRevision)
      trackInteraction('artifact.zoomed', { zoom: state.zoom, source: 'controls' })
  })
}
