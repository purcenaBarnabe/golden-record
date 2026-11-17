import { Minus, Plus, RotateCcw, ScanLine, SunMedium, Microscope } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { useShallow } from 'zustand/react/shallow'
import { IconButton } from '../ui/IconButton'
import { MAX_ZOOM, MIN_ZOOM } from '../../lib/inspection'

export function ViewerControls({
  disabled,
  loading = false,
}: {
  disabled: boolean
  loading?: boolean
}) {
  const s = useExhibitStore(
    useShallow((s) => ({
      artifact: s.artifact,
      annotations: s.annotations,
      lighting: s.lighting,
      zoom: s.zoom,
      reset: s.reset,
      inspectTexture: s.inspectTexture,
      toggleAnnotations: s.toggleAnnotations,
      toggleLighting: s.toggleLighting,
      changeZoom: s.changeZoom,
      setArtifact: s.setArtifact,
    })),
  )
  return (
    <Tooltip.Provider delayDuration={200}>
      <div
        className="viewer-toolbar"
        role="toolbar"
        aria-label="Inspection controls"
        id="viewer-controls"
        tabIndex={-1}
      >
        <div className="surface-switch" aria-label="Visible surface">
          <button
            disabled={loading}
            aria-pressed={s.artifact === 'cover'}
            onClick={() => s.setArtifact('cover')}
          >
            Cover
          </button>
          <button
            disabled={loading}
            aria-pressed={s.artifact === 'record'}
            onClick={() => s.setArtifact('record')}
          >
            Record
          </button>
        </div>
        <span className="toolbar-divider" />
        <IconButton
          label="Zoom out"
          onClick={() => s.changeZoom(-0.25)}
          disabled={disabled || s.zoom <= MIN_ZOOM}
        >
          <Minus size={17} strokeWidth={1.4} />
        </IconButton>
        <IconButton
          label="Zoom in"
          onClick={() => s.changeZoom(0.25)}
          disabled={disabled || s.zoom >= MAX_ZOOM}
        >
          <Plus size={17} strokeWidth={1.4} />
        </IconButton>
        <IconButton label="Inspect surface texture" onClick={s.inspectTexture} disabled={disabled}>
          <Microscope size={18} strokeWidth={1.4} />
        </IconButton>
        <IconButton label="Reset view" onClick={s.reset} disabled={disabled}>
          <RotateCcw size={16} strokeWidth={1.4} />
        </IconButton>
        <span className="toolbar-divider" />
        <IconButton
          label={s.annotations ? 'Hide engraving markers' : 'Show engraving markers'}
          aria-pressed={s.annotations}
          onClick={s.toggleAnnotations}
          disabled={disabled || s.artifact !== 'cover'}
        >
          <ScanLine size={17} strokeWidth={1.4} />
        </IconButton>
        <IconButton
          label={s.lighting === 'gallery' ? 'Use raking light' : 'Use studio light'}
          aria-pressed={s.lighting === 'raking'}
          onClick={s.toggleLighting}
          disabled={disabled}
        >
          <SunMedium size={18} strokeWidth={1.4} />
        </IconButton>
        <output className="sr-only" aria-live="polite">
          Zoom {Math.round(s.zoom * 100)}%
        </output>
      </div>
    </Tooltip.Provider>
  )
}
