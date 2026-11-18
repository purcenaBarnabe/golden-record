import { useExhibitStore } from '../../stores/use-exhibit-store'

export function SurfaceSwitch({ disabled }: { disabled: boolean }) {
  const artifact = useExhibitStore((s) => s.artifact)
  const setArtifact = useExhibitStore((s) => s.setArtifact)
  return (
    <button
      type="button"
      className="surface-switch"
      role="switch"
      aria-label="Show record"
      aria-checked={artifact === 'record'}
      disabled={disabled}
      onClick={() => setArtifact(artifact === 'cover' ? 'record' : 'cover')}
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
  )
}
