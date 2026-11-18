import type { Inscription } from '../../lib/inscriptions'
import { useI18n } from '../../lib/i18n'

export function DiagramPreview({
  item,
  className = '',
}: {
  item: Inscription
  className?: string
}) {
  const { t } = useI18n()
  return (
    <div className={`diagram-preview ${className}`}>
      <img
        src={`/assets/diagrams/${item.id}.webp`}
        alt={t.details.image(t.inscriptions[item.id].category)}
        width="300"
        height="150"
        loading="lazy"
      />
    </div>
  )
}
