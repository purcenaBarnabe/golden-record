import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { ViewerControls } from './ViewerControls'
import { finishSceneObservation, reportFailure, trackInteraction } from '../../lib/observability'
import { useI18n } from '../../lib/i18n'

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
  componentDidCatch(error: Error, info: ErrorInfo) {
    reportFailure(error, 'scene', { component_stack: info.componentStack ?? '' })
    this.props.onUnavailable()
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children
  }
}

function Fallback() {
  const { t } = useI18n()
  const artifact = useExhibitStore((s) => s.artifact)
  return (
    <div className="webgl-fallback">
      <img
        src={`/assets/${artifact === 'cover' ? 'cover' : 'record'}-original.jpg`}
        alt={artifact === 'cover' ? t.exhibit.coverPhoto : t.exhibit.recordPhoto}
      />
      <p>{t.exhibit.fallback}</p>
    </div>
  )
}

export function ArtifactViewer({ ready, onReady }: { ready: boolean; onReady: () => void }) {
  const { t, number } = useI18n()
  const [Scene, setScene] = useState<SceneComponent | null>(null)
  const [available, setAvailable] = useState(true)
  const artifact = useExhibitStore((s) => s.artifact)
  const setPanel = useExhibitStore((s) => s.setPanel)
  const zoom = useExhibitStore((s) => s.zoom)
  const sceneReady = useCallback(() => {
    finishSceneObservation('ok')
    onReady()
  }, [onReady])
  const onUnavailable = useCallback(() => {
    finishSceneObservation('error')
    trackInteraction('scene.unavailable')
    onReady()
    setAvailable(false)
  }, [onReady])
  useEffect(() => {
    let active = true
    loadScene().then(
      (module) => {
        if (active) setScene(() => module.ArtifactScene)
      },
      (error: unknown) => {
        if (active) {
          reportFailure(error, 'scene.chunk')
          onUnavailable()
        }
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
          <span>{t.exhibit.preparing}</span>
        </div>
      )}
      {!available ? (
        <Fallback />
      ) : (
        Scene && (
          <SceneBoundary onUnavailable={onUnavailable}>
            <Scene onReady={sceneReady} onUnavailable={onUnavailable} />
          </SceneBoundary>
        )
      )}
      <div className="gallery-bottom">
        <p className="gesture-hint">{t.exhibit.gestures}</p>
        <ViewerControls disabled={!available || !ready} />
        <p className="surface-caption" aria-live="polite">
          {artifact === 'cover' ? (
            <>
              {t.exhibit.cover}
              {zoom > 8 && <span className="magnification">{number(Math.round(zoom))}×</span>}
            </>
          ) : (
            <button className="listen-caption" onClick={() => setPanel('music')}>
              {t.exhibit.record} {zoom > 8 && <small>{number(Math.round(zoom))}×</small>}
              <span>{t.exhibit.listen}</span>
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
