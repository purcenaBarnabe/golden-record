import { HandGrab, Minus, Orbit, Plus, RotateCcw, SunMedium } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { useShallow } from 'zustand/react/shallow'
import { IconButton } from '../ui/IconButton'
import { MAX_ZOOM, MIN_ZOOM } from '../../lib/inspection'
import { trackInteraction } from '../../lib/observability'
import { useI18n } from '../../lib/i18n'

export function ViewerControls({ disabled }: { disabled: boolean }) {
  const { t, number } = useI18n()
  const s = useExhibitStore(
    useShallow((s) => ({
      mobileNavigationMode: s.mobileNavigationMode,
      setMobileNavigationMode: s.setMobileNavigationMode,
      lighting: s.lighting,
      zoom: s.zoom,
      reset: s.reset,
      toggleLighting: s.toggleLighting,
      changeZoom: s.changeZoom,
    })),
  )
  return (
    <Tooltip.Provider delayDuration={200}>
      <div
        className="viewer-toolbar"
        role="toolbar"
        aria-label={t.controls.label}
        id="viewer-controls"
        tabIndex={-1}
      >
        <div className="mobile-navigation-modes" role="group" aria-label={t.controls.touch}>
          <button
            type="button"
            aria-pressed={s.mobileNavigationMode === 'drag'}
            disabled={disabled}
            onClick={() => s.setMobileNavigationMode('drag')}
          >
            <HandGrab size={14} strokeWidth={1.6} aria-hidden="true" />
            {t.controls.drag}
          </button>
          <button
            type="button"
            aria-pressed={s.mobileNavigationMode === 'orbit'}
            disabled={disabled}
            onClick={() => s.setMobileNavigationMode('orbit')}
          >
            <Orbit size={14} strokeWidth={1.6} aria-hidden="true" />
            {t.controls.orbit}
          </button>
        </div>
        <span className="toolbar-divider mobile-navigation-divider" />
        <IconButton
          label={t.controls.zoomOut}
          onClick={() => s.changeZoom(-0.25)}
          disabled={disabled || s.zoom <= MIN_ZOOM}
        >
          <Minus size={19} strokeWidth={1.7} />
        </IconButton>
        <IconButton
          label={t.controls.zoomIn}
          onClick={() => s.changeZoom(0.25)}
          disabled={disabled || s.zoom >= MAX_ZOOM}
        >
          <Plus size={19} strokeWidth={1.7} />
        </IconButton>
        <IconButton
          label={t.controls.reset}
          onClick={() => {
            trackInteraction('artifact.reset')
            s.reset()
          }}
          disabled={disabled}
        >
          <RotateCcw size={18} strokeWidth={1.7} />
        </IconButton>
        <IconButton
          className="desktop-viewer-control"
          label={s.lighting === 'gallery' ? t.controls.raking : t.controls.studio}
          aria-pressed={s.lighting === 'raking'}
          onClick={s.toggleLighting}
          disabled={disabled}
        >
          <SunMedium size={20} strokeWidth={1.7} />
        </IconButton>
        <output className="sr-only" aria-live="polite">
          {t.controls.zoom(
            number(s.zoom, { style: 'percent', maximumFractionDigits: 0, useGrouping: false }),
          )}
        </output>
      </div>
    </Tooltip.Provider>
  )
}
