import type { Inscription } from '../../lib/inscriptions'

export function DiagramPreview({
  item,
  className = '',
}: {
  item: Inscription
  className?: string
}) {
  return (
    <div className={`diagram-preview ${className}`}>
      <img
        src={`/assets/diagrams/${item.id}.webp`}
        alt={`${item.category} engraving`}
        width="300"
        height="150"
        loading="lazy"
      />
    </div>
  )
}
