import { useI18n } from '../../lib/i18n'
import { useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Headphones, ArrowUpRight } from 'lucide-react'
import { Vector3, type Group } from 'three'
import { RECORD_RADIUS, RECORD_THICKNESS } from '../../lib/artifact-dimensions'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { AnnotationCard, hoveringAnnotation, withinAnnotation } from './AnnotationCard'
import { useProjectedSubject } from './use-projected-subject'

export function RecordAnnotation() {
  const { t } = useI18n()
  const hovered = useExhibitStore((s) => s.hovered === 'music')
  const panel = useExhibitStore((s) => s.panel)
  const setHovered = useExhibitStore((s) => s.setAnnotationHovered)
  const setPanel = useExhibitStore((s) => s.setPanel)
  const root = useRef<Group>(null)
  const project = useProjectedSubject(root, RECORD_RADIUS, -RECORD_THICKNESS / 2)
  const anchor = useRef<HTMLDivElement>(null)
  const visible = useRef(false)
  const world = useRef(new Vector3()).current
  const direction = useRef(new Vector3()).current
  useFrame(({ camera }) => {
    if (!root.current) return
    root.current.getWorldPosition(world)
    direction.copy(camera.position).sub(world).normalize()
    const back = direction.z < -0.015
    if (visible.current !== back) {
      visible.current = back
      if (anchor.current) anchor.current.style.visibility = back ? 'visible' : 'hidden'
      if (!back && useExhibitStore.getState().hovered === 'music')
        useExhibitStore.getState().clearHover()
    }
  })
  return (
    <group ref={root}>
      <Html
        position={[0, 0.0366, -RECORD_THICKNESS / 2 - 0.0004]}
        center
        zIndexRange={[20, 10]}
        wrapperClass={`annotation-layer ${hovered ? 'is-active' : ''}`}
        className="annotation-anchor record-annotation-anchor"
        ref={(element) => {
          anchor.current = element
          if (element) element.style.visibility = visible.current ? 'visible' : 'hidden'
        }}
        style={{ visibility: visible.current ? 'visible' : 'hidden' }}
      >
        <div
          className={`annotation record-annotation ${hovered ? 'is-hovered' : ''}`}
          data-inscription="music"
          onPointerEnter={() => setHovered('music')}
          onPointerLeave={(e) => {
            if (
              !withinAnnotation('music', e.relatedTarget) &&
              !withinAnnotation('music', document.activeElement)
            )
              setHovered(null)
          }}
          onPointerMove={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              useExhibitStore.getState().clearHover()
            }
          }}
          onFocus={() => setHovered('music')}
          onBlur={(e) => {
            if (!withinAnnotation('music', e.relatedTarget) && !hoveringAnnotation('music'))
              setHovered(null)
          }}
        >
          <button
            className="record-music-dot"
            aria-label={t.music.explore}
            aria-expanded={panel === 'music'}
            onClick={(e) => {
              e.stopPropagation()
              setPanel('music')
            }}
          >
            <Headphones size={13} strokeWidth={1.5} />
          </button>
          {hovered && !panel && (
            <AnnotationCard
              target="music"
              projectSubject={() => ({
                ...project([0.25, 0.25, 0.5, 0.5]),
                surface: project([0, 0, 1, 1]).subject,
              })}
              className="music-info-card"
            >
              <span className="card-category">{t.music.category}</span>
              <h3>{t.music.title}</h3>
              <p>{t.music.preview}</p>
              <button onClick={() => setPanel('music')}>
                {t.music.listen} <ArrowUpRight size={14} />
              </button>
            </AnnotationCard>
          )}
        </div>
      </Html>
    </group>
  )
}
