import { useExhibitStore } from '../../stores/use-exhibit-store'
import { useI18n } from '../../lib/i18n'

export function SurfaceSwitch({ disabled }: { disabled: boolean }) {
  const { t } = useI18n()
  const artifact = useExhibitStore((s) => s.artifact)
  const setArtifact = useExhibitStore((s) => s.setArtifact)
  return (
    <button
      type="button"
      className="surface-switch"
      role="switch"
      aria-label={t.exhibit.showRecord}
      aria-checked={artifact === 'record'}
      disabled={disabled}
      onClick={() => setArtifact(artifact === 'cover' ? 'record' : 'cover')}
    >
      <span className="surface-label-cover" aria-hidden="true">
        {t.exhibit.coverSwitch}
      </span>
      <span className="surface-switch-track" aria-hidden="true">
        <span className="surface-switch-thumb" />
      </span>
      <span className="surface-label-record" aria-hidden="true">
        {t.exhibit.recordSwitch}
      </span>
    </button>
  )
}
