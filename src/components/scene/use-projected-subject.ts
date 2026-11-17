import { useCallback, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3, type Group } from 'three'
import { intersectRect, type ProjectedSubject, type ScreenRect } from '../../lib/callout-placement'

export function useProjectedSubject(root: RefObject<Group | null>, radius: number, z: number) {
  const camera = useThree((s) => s.camera)
  const canvas = useThree((s) => s.gl.domElement)
  return useCallback(
    (
      bounds: [number, number, number, number],
      anchorPoint?: [number, number],
    ): ProjectedSubject => {
      const box = canvas.getBoundingClientRect()
      const viewport: ScreenRect = { x: box.x, y: box.y, width: box.width, height: box.height }
      if (!root.current) return { subject: null, viewport }
      camera.updateMatrixWorld()
      root.current.updateWorldMatrix(true, false)
      const toCamera = ([u, v]: number[]) =>
        new Vector3((u - 0.5) * radius * 2, (0.5 - v) * radius * 2, z)
          .applyMatrix4(root.current!.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse)
      const toScreen = (point: Vector3) => {
        point.applyMatrix4(camera.projectionMatrix)
        return {
          x: box.x + ((point.x + 1) * box.width) / 2,
          y: box.y + ((1 - point.y) * box.height) / 2,
        }
      }
      const hit = anchorPoint ? toCamera(anchorPoint) : null
      const anchor = hit && hit.z < -camera.near ? toScreen(hit) : undefined
      const [x, y, width, height] = bounds
      // The full surface follows the circular silhouette, not the invisible
      // picking square, so cards can sit close to the actual metal edge.
      const outline =
        x === 0 && y === 0 && width === 1 && height === 1
          ? Array.from({ length: 48 }, (_, i) => [
              0.5 + Math.cos((i / 48) * Math.PI * 2) * 0.5,
              0.5 + Math.sin((i / 48) * Math.PI * 2) * 0.5,
            ])
          : [
              [x, y],
              [x + width, y],
              [x + width, y + height],
              [x, y + height],
            ]
      let polygon = outline.map(toCamera)
      // Clip against the near plane before projecting. At microscope distances a
      // large figure may extend behind the camera, despite its visible center.
      const clipped: Vector3[] = []
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length]
        const aIn = a.z < -camera.near,
          bIn = b.z < -camera.near
        if (aIn) clipped.push(a)
        if (aIn !== bIn) clipped.push(a.clone().lerp(b, (-camera.near - a.z) / (b.z - a.z)))
      }
      polygon = clipped
      if (!polygon.length) return { subject: null, viewport, anchor }
      const points = polygon.map(toScreen)
      const xs = points.map((point) => point.x),
        ys = points.map((point) => point.y)
      const projected = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      }
      return { subject: intersectRect(projected, viewport), viewport, anchor }
    },
    [camera, canvas, radius, root, z],
  )
}
