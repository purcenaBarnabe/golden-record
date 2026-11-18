import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { ViewerControls } from './ViewerControls'

const loadScene = () => import('../scene/ArtifactScene')
// Start the split chunk while the gallery hydrates, without loading WebGL during SSR.
if (typeof window !== 'undefined') void loadScene().catch(() => {})
type SceneComponent = (typeof import('../scene/ArtifactScene'))['ArtifactScene']

class SceneBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onUnavailable()
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children
  }
}

function Fallback() {
  const artifact = useExhibitStore((s) => s.artifact)
  return (
    <div className="webgl-fallback">
      <img
        src={`/assets/${artifact === 'cover' ? 'cover' : 'record'}-original.jpg`}
        alt={`NASA reference photograph of the Golden Record ${artifact}`}
      />
      <p>
        3D is unavailable in this browser. You can still listen to the record’s music and read about
        this recreation.
      </p>
    </div>
  )
}

export function ArtifactViewer({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  const [Scene, setScene] = useState<SceneComponent | null>(null)
  const [available, setAvailable] = useState(true)
  const artifact = useExhibitStore((s) => s.artifact)
  const setPanel = useExhibitStore((s) => s.setPanel)
  const zoom = useExhibitStore((s) => s.zoom)
  const onUnavailable = useCallback(() => {
    onReady()
    setAvailable(false)
  }, [onReady])
  useEffect(() => {
    let active = true
    loadScene().then(
      (module) => {
        if (active) setScene(() => module.ArtifactScene)
      },
      () => {
        if (active) onUnavailable()
      },
    )
    return () => {
      active = false
    }
  }, [onUnavailable])
  return (
    <div className="artifact-viewer" id="artifact" aria-busy={!ready}>
      {!ready && (
        <div className="scene-loading" role="status">
          <span className="loading-ring" />
          <span>Preparing the record</span>
        </div>
      )}
      {!available ? (
        <Fallback />
      ) : (
        Scene && (
          <SceneBoundary onUnavailable={onUnavailable}>
            <Scene onReady={onReady} onUnavailable={onUnavailable} />
          </SceneBoundary>
        )
      )}
      <div className="gallery-bottom">
        <p className="gesture-hint">Scroll to zoom · Drag to orbit · Right-drag to pan</p>
        <ViewerControls disabled={!available || !ready} />
        <p className="surface-caption" aria-live="polite">
          {artifact === 'cover' ? (
            <>
              Engraved protective cover
              {zoom > 8 && <span className="magnification">{Math.round(zoom)}×</span>}
            </>
          ) : (
            <button className="listen-caption" onClick={() => setPanel('music')}>
              The Sounds of Earth · Side 1 {zoom > 8 && <small>{Math.round(zoom)}×</small>}
              <span>Listen</span>
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
