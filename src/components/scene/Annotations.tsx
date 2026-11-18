import { useI18n } from '../../lib/i18n'
import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Vector3, type Group } from 'three'
import { ArrowUpRight, Focus } from 'lucide-react'
import { artworkPosition, inscriptions } from '../../lib/inscriptions'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { COVER_RADIUS } from './RecordModel'
import { COVER_FACE_Z } from '../../lib/artifact-dimensions'
import { AnnotationCard, hoveringAnnotation, withinAnnotation } from './AnnotationCard'
import { useProjectedSubject } from './use-projected-subject'

export function Annotations() {
  const { t } = useI18n()
  const localizedInscriptions = inscriptions.map((item) => ({
    ...item,
    ...t.inscriptions[item.id],
  }))
  const hovered = useExhibitStore((s) => s.hovered)
  const selected = useExhibitStore((s) => s.selected)
  const markers = useExhibitStore((s) => s.markersVisible)
  const setHovered = useExhibitStore((s) => s.setAnnotationHovered)
  const clearHover = useExhibitStore((s) => s.clearHover)
  const inspectEngraving = useExhibitStore((s) => s.inspectEngraving)
  const setSelected = useExhibitStore((s) => s.setSelected)
  const root = useRef<Group>(null)
  const project = useProjectedSubject(root, COVER_RADIUS, COVER_FACE_Z)
  const front = useRef(true)
  const normal = useMemoVector()
  const world = useMemoVector()
  const direction = useMemoVector()
  useFrame(({ camera }) => {
    if (!root.current) return
    root.current.getWorldPosition(world)
    normal.set(0, 0, 1).transformDirection(root.current.matrixWorld)
    const isFront = normal.dot(direction.copy(camera.position).sub(world).normalize()) > 0.015
    if (isFront !== front.current) {
      front.current = isFront
      const elements = document.querySelectorAll<HTMLElement>('.cover-annotation-anchor')
      elements.forEach((el) => {
        el.style.visibility = isFront ? 'visible' : 'hidden'
      })
      if (!isFront && useExhibitStore.getState().hovered !== 'music') clearHover()
    }
  })
  return (
    <group ref={root}>
      {localizedInscriptions.map((item) => (
        <Html
          key={item.id}
          position={
            artworkPosition(item.markerPoint, COVER_RADIUS).map((v, i) =>
              i === 2 ? COVER_FACE_Z + 0.0004 : v,
            ) as [number, number, number]
          }
          center
          zIndexRange={[20, 10]}
          wrapperClass={`annotation-layer ${hovered === item.id ? 'is-active' : ''}`}
          className="annotation-anchor cover-annotation-anchor"
          ref={(element) => {
            if (element) element.style.visibility = front.current ? 'visible' : 'hidden'
          }}
          style={{ visibility: front.current ? 'visible' : 'hidden' }}
        >
          <div
            data-inscription={item.id}
            className={`annotation ${markers ? 'show-marker' : ''} ${hovered === item.id ? 'is-hovered' : ''} ${selected === item.id ? 'is-selected' : ''}`}
            onPointerEnter={() => setHovered(item.id)}
            onPointerLeave={(e) => {
              if (
                !withinAnnotation(item.id, e.relatedTarget) &&
                !withinAnnotation(item.id, document.activeElement)
              )
                setHovered(null)
            }}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                clearHover()
              }
            }}
            onFocus={() => setHovered(item.id)}
            onBlur={(e) => {
              if (!withinAnnotation(item.id, e.relatedTarget) && !hoveringAnnotation(item.id))
                setHovered(null)
            }}
          >
            <button
              className="annotation-dot"
              aria-label={t.details.explore(item.category)}
              aria-expanded={selected === item.id}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(item.id)
              }}
            >
              <span aria-hidden="true">i</span>
            </button>
            {hovered === item.id && !selected && (
              <AnnotationCard
                target={item.id}
                projectSubject={() => ({
                  ...project(item.bounds),
                  surface: project([0, 0, 1, 1]).subject,
                  neighbors: inscriptions
                    .filter((other) => other.id !== item.id)
                    .map((other) => project(other.bounds).subject)
                    .filter((region) => region !== null),
                })}
              >
                <span className="card-category">{item.category}</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <button className="annotation-action" onClick={() => setSelected(item.id)}>
                  {t.details.meaning} <ArrowUpRight size={14} />
                </button>
                <button className="annotation-action" onClick={() => inspectEngraving(item.id)}>
                  {t.details.inspect} <Focus size={14} />
                </button>
              </AnnotationCard>
            )}
          </div>
        </Html>
      ))}
    </group>
  )
}

function useMemoVector() {
  return useRef(new Vector3()).current
}
