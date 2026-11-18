import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  calloutCorridor,
  placeCallout,
  type CalloutPlacement,
  type ProjectedSubject,
  type ScreenRect,
} from '../../lib/callout-placement'
import { useExhibitStore, type HoverTarget } from '../../stores/use-exhibit-store'
import { trackInteraction } from '../../lib/observability'

export const withinAnnotation = (target: HoverTarget, element: EventTarget | null) =>
  element instanceof Element && Boolean(element.closest(`[data-inscription="${target}"]`))
export const hoveringAnnotation = (target: HoverTarget) =>
  Boolean(document.querySelector(`[data-inscription="${target}"]:hover`))
const rectOf = (element: Element): ScreenRect => {
  const r = element.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height }
}

/** Float around the projected subject, or reserve a separate reading rail. */
export function AnnotationCard({
  target,
  projectSubject,
  className = '',
  children,
}: {
  target: HoverTarget
  projectSubject: () => ProjectedSubject
  className?: string
  children: ReactNode
}) {
  const card = useRef<HTMLDivElement>(null)
  const connector = useRef<SVGPathElement>(null)
  const corridor = useRef<SVGPolygonElement>(null)
  const projection = useRef(projectSubject)
  projection.current = projectSubject
  const owner = useId()
  useEffect(() => {
    const timer = setTimeout(() => {
      if (card.current && getComputedStyle(card.current).visibility === 'visible')
        trackInteraction('infocard.previewed', { inscription: target })
    }, 500)
    return () => clearTimeout(timer)
  }, [target])
  const enter = () => useExhibitStore.getState().setAnnotationHovered(target)
  const leave = (relatedTarget: EventTarget | null) => {
    const next = relatedTarget instanceof Element ? relatedTarget : null
    if (next?.closest(`[data-inscription="${target}"], [data-callout-owner="${owner}"]`)) return
    if (withinAnnotation(target, document.activeElement)) return
    useExhibitStore.getState().setAnnotationHovered(null)
  }
  useLayoutEffect(() => {
    const element = card.current
    const viewer = document.getElementById('artifact')
    const marker = document.querySelector(`.annotation[data-inscription="${target}"]`)
    if (!element || !viewer || !marker) return
    let frame = 0,
      dock: 'right' | 'bottom' | null = null
    let previous: CalloutPlacement | null = null
    const place = () => {
      if (!element.isConnected) return
      const origin = marker.getBoundingClientRect()
      const markerAnchor = { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 }
      const header = document.querySelector('.gallery-header')?.getBoundingClientRect()
      const footer = document.querySelector('.gallery-bottom')?.getBoundingClientRect()
      const top = header ? header.bottom + 16 : 12,
        bottom = footer ? innerHeight - footer.top + 16 : 60
      const bounds = { x: 12, y: top, width: innerWidth - 24, height: innerHeight - top - bottom }
      element.style.maxHeight = `${Math.max(0, bounds.height)}px`
      const obstacles = [
        ...document.querySelectorAll('.gallery-header, .gallery-bottom, .mini-player'),
      ].map(rectOf)
      const context = projection.current()
      const anchor = markerAnchor
      let { subject, viewport } = context
      let size = element.getBoundingClientRect()
      let position = dock
        ? null
        : placeCallout({
            subject,
            anchor,
            width: size.width,
            height: size.height,
            frame: bounds,
            obstacles: [...obstacles, ...(context.neighbors ?? [])],
            avoid: context.surface ? [context.surface] : [],
            previous,
          })
      if (!position) {
        dock = innerWidth >= 700 || innerWidth / innerHeight > 1.45 ? 'right' : 'bottom'
        element.dataset.docked = dock
        viewer.dataset.calloutDock = dock
        viewer.dataset.calloutOwner = owner
        size = element.getBoundingClientRect()
        if (dock === 'right') {
          const rail = size.width + 32
          viewer.style.setProperty('--callout-rail', `${rail}px`)
          position = placeCallout({
            subject: null,
            anchor,
            width: size.width,
            height: size.height,
            frame: { x: innerWidth - rail + 16, y: top, width: size.width, height: bounds.height },
            obstacles,
          }) ?? {
            x: innerWidth - rail + 16,
            y: top,
            width: size.width,
            height: size.height,
            side: 'right',
          }
        } else {
          const mini = document.querySelector('.mini-player')?.getBoundingClientRect()
          const footerHeight = footer ? innerHeight - footer.top + 12 : bottom
          const miniHeight = mini ? mini.height + 16 : 0
          element.style.maxHeight = `${Math.max(0, innerHeight - top - footerHeight - miniHeight - 16)}px`
          size = element.getBoundingClientRect()
          const rail = size.height + footerHeight + miniHeight + 32
          viewer.style.setProperty('--callout-rail', `${rail}px`)
          position = {
            x: (innerWidth - size.width) / 2,
            y: innerHeight - footerHeight - miniHeight - size.height - 16,
            width: size.width,
            height: size.height,
            side: 'bottom',
          }
        }
        // The renderer resizes asynchronously. Keep the reading rail invisible
        // until it is genuinely outside the rendered inspection viewport.
        ;({ subject, viewport } = projection.current())
        const separated =
          dock === 'right'
            ? viewport.x + viewport.width <= position.x - 6
            : viewport.y + viewport.height <= position.y - 6
        element.style.visibility = separated ? 'visible' : 'hidden'
        if (!separated) schedule()
      } else element.style.visibility = 'visible'
      previous = position
      element.style.left = `${position.x}px`
      element.style.top = `${position.y}px`
      element.style.right = 'auto'
      element.style.transform = 'none'
      element.dataset.placement = dock ? `rail-${dock}` : position.side
      element.dataset.subject = JSON.stringify(subject)
      const path = calloutCorridor(anchor, position)
      connector.current?.setAttribute(
        'd',
        `M${anchor.x},${anchor.y} L${path.edge.x},${path.edge.y}`,
      )
      // Keep approaches from both the engraving and its marker safe, while the
      // visible connector always ends at the marker.
      const state = useExhibitStore.getState()
      corridor.current?.setAttribute(
        'points',
        calloutCorridor(
          anchor,
          position,
          state.hovered === target ? (state.surfaceHoverPoint ?? undefined) : undefined,
        ).polygon,
      )
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    place()
    const observer = new MutationObserver(schedule)
    const layer = marker.closest('.annotation-layer')
    if (layer) observer.observe(layer, { attributes: true, attributeFilter: ['style'] })
    const resize = new ResizeObserver(schedule)
    resize.observe(element)
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', schedule)
      if (viewer.dataset.calloutOwner === owner) {
        delete viewer.dataset.calloutDock
        delete viewer.dataset.calloutOwner
        viewer.style.removeProperty('--callout-rail')
      }
    }
  }, [owner, target])
  return typeof document === 'undefined'
    ? null
    : createPortal(
        <div className="callout-layer" data-inscription={target}>
          <svg className="annotation-connector" aria-hidden="true">
            <path ref={connector} />
            <polygon
              ref={corridor}
              data-callout-owner={owner}
              className="annotation-corridor"
              onPointerEnter={enter}
              onPointerLeave={(event) => leave(event.relatedTarget)}
              onPointerMove={(event) => event.stopPropagation()}
            />
          </svg>
          <div
            ref={card}
            data-callout-owner={owner}
            className={`annotation-card ${className}`}
            style={{ visibility: 'hidden' }}
            onPointerEnter={enter}
            onPointerLeave={(event) => leave(event.relatedTarget)}
          >
            {children}
          </div>
        </div>,
        document.body,
      )
}
