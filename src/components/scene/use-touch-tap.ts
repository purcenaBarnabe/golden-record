import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'

const TAP_MOVEMENT = 5

/** Keep touch activation on pointer coordinates: browsers can adjust synthetic clicks
 * toward a nearby DOM marker, changing both the hit point and R3F's click delta. */
export function useTouchTap() {
  const canvas = useThree((s) => s.gl.domElement)
  const tap = useRef<PointerEvent | null>(null)
  const handled = useRef(false)
  const pointerType = useRef('')
  useEffect(() => {
    const document = canvas.ownerDocument
    const touches = new Set<number>()
    let candidate: { id: number; x: number; y: number } | null = null
    const moved = (event: PointerEvent) => {
      if (
        candidate?.id === event.pointerId &&
        Math.hypot(event.clientX - candidate.x, event.clientY - candidate.y) > TAP_MOVEMENT
      )
        candidate = null
    }
    const down = (event: PointerEvent) => {
      pointerType.current = event.pointerType
      tap.current = null
      handled.current = false
      if (event.pointerType !== 'touch') return
      touches.add(event.pointerId)
      candidate =
        touches.size === 1 && event.target === canvas
          ? { id: event.pointerId, x: event.clientX, y: event.clientY }
          : null
    }
    const up = (event: PointerEvent) => {
      moved(event)
      tap.current = candidate?.id === event.pointerId && touches.size === 1 ? event : null
      touches.delete(event.pointerId)
      candidate = null
    }
    const cancel = (event: PointerEvent) => {
      touches.delete(event.pointerId)
      candidate = null
      tap.current = null
    }
    const click = (event: MouseEvent) => {
      if (!handled.current) return
      handled.current = false
      // The dialog may already cover this point. Don't let the compatibility
      // click land on a newly mounted dialog button or activate the surface twice.
      event.preventDefault()
      event.stopPropagation()
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointermove', moved, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', cancel, true)
    document.addEventListener('click', click, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointermove', moved, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', cancel, true)
      document.removeEventListener('click', click, true)
    }
  }, [canvas])
  return {
    consumeTouchTap: (event: PointerEvent) => {
      if (tap.current !== event) return false
      tap.current = null
      handled.current = true
      return true
    },
    isTouchClick: () => pointerType.current === 'touch',
  }
}
