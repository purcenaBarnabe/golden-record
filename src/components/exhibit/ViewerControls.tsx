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
        <button
          type="button"
          className="surface-switch"
          role="switch"
          aria-label="Show record"
          aria-checked={s.artifact === 'record'}
          disabled={loading}
          onClick={() => s.setArtifact(s.artifact === 'cover' ? 'record' : 'cover')}
        >
          <span className="surface-label-cover" aria-hidden="true">
            Cover
          </span>
          <span className="surface-switch-track" aria-hidden="true">
            <span className="surface-switch-thumb" />
          </span>
          <span className="surface-label-record" aria-hidden="true">
            Record
          </span>
        </button>
        <span className="toolbar-divider" />
        <IconButton
          label="Zoom out"
          onClick={() => s.changeZoom(-0.25)}
          disabled={disabled || s.zoom <= MIN_ZOOM}
        >
          <Minus size={19} strokeWidth={1.7} />
        </IconButton>
        <IconButton
          label="Zoom in"
          onClick={() => s.changeZoom(0.25)}
          disabled={disabled || s.zoom >= MAX_ZOOM}
        >
          <Plus size={19} strokeWidth={1.7} />
        </IconButton>
        <IconButton
          className="desktop-viewer-control"
          label="Inspect surface texture"
          onClick={s.inspectTexture}
          disabled={disabled}
        >
          <Microscope size={20} strokeWidth={1.7} />
        </IconButton>
        <IconButton label="Reset view" onClick={s.reset} disabled={disabled}>
          <RotateCcw size={18} strokeWidth={1.7} />
        </IconButton>
        <span className="toolbar-divider marker-divider" />
        <IconButton
          label={s.annotations ? 'Hide engraving markers' : 'Show engraving markers'}
          aria-pressed={s.annotations}
          onClick={s.toggleAnnotations}
          disabled={disabled || s.artifact !== 'cover'}
        >
          <ScanLine size={19} strokeWidth={1.7} />
        </IconButton>
        <IconButton
          className="desktop-viewer-control"
          label={s.lighting === 'gallery' ? 'Use raking light' : 'Use studio light'}
          aria-pressed={s.lighting === 'raking'}
          onClick={s.toggleLighting}
          disabled={disabled}
        >
          <SunMedium size={20} strokeWidth={1.7} />
        </IconButton>
        <output className="sr-only" aria-live="polite">
          Zoom {Math.round(s.zoom * 100)}%
        </output>
      </div>
    </Tooltip.Provider>
  )
}
