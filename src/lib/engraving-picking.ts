import { Matrix4, Vector2, Vector4, type Box3, type BufferGeometry, type Triangle } from 'three'
import { MeshBVH } from 'three-mesh-bvh'
import type { CoverRelief } from './engraved-cover'
import { COVER_RADIUS } from './artifact-dimensions'
import { inscriptionAtUv, inscriptions, type InscriptionId } from './inscriptions'

export const ENGRAVING_HOVER_TOLERANCE = 4 // CSS pixels, independent of zoom and DPR.
const trees = new WeakMap<BufferGeometry, MeshBVH>()
function treeFor(geometry: BufferGeometry) {
  let tree = trees.get(geometry)
  if (!tree) {
    // Indirect indexing leaves the rendered geometry and its GPU buffers intact.
    const options = { maxLeafTris: 10, indirect: true }
    tree = new MeshBVH(geometry, options)
    trees.set(geometry, tree)
  }
  return tree
}

function segmentDistanceSquared(p: Vector2, a: Vector2, b: Vector2) {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  )
  return (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2
}
function triangleDistanceSquared(p: Vector2, a: Vector2, b: Vector2, c: Vector2) {
  const cross = (u: Vector2, v: Vector2) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x)
  const ab = cross(a, b),
    bc = cross(b, c),
    ca = cross(c, a)
  const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  if (
    Math.abs(area) > 1e-12 &&
    ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0))
  )
    return 0
  return Math.min(
    segmentDistanceSquared(p, a, b),
    segmentDistanceSquared(p, b, c),
    segmentDistanceSquared(p, c, a),
  )
}

// Rectangles identify a cut's subject only after geometry has been hit. A few
// transcription marks extend just outside those editorial bounds.
function subjectOf(triangle: Triangle): InscriptionId {
  const u = 0.5 + (triangle.a.x + triangle.b.x + triangle.c.x) / (6 * COVER_RADIUS)
  const v = 0.5 + (triangle.a.y + triangle.b.y + triangle.c.y) / (6 * COVER_RADIUS)
  const containing = inscriptionAtUv(u, v)
  if (containing) return containing.id
  let nearest = inscriptions[0],
    distance = Infinity
  for (const item of inscriptions) {
    const [x, y, w, h] = item.bounds
    const d = Math.hypot(Math.max(x - u, 0, u - x - w), Math.max(y - (1 - v), 0, 1 - v - y - h))
    if (d < distance) {
      nearest = item
      distance = d
    }
  }
  return nearest.id
}

/** Query only the recessed walls/floors, with a small screen-space allowance. */
export class EngravingPicker {
  private readonly trees: MeshBVH[]
  private readonly matrix = new Matrix4()
  private readonly corner = new Vector4()
  private readonly vertices = Array.from({ length: 3 }, () => new Vector4())
  private readonly clipped = Array.from({ length: 4 }, () => new Vector4())
  private readonly projected = Array.from({ length: 4 }, () => new Vector2())
  private readonly pointer = new Vector2()
  private halfWidth = 1
  private halfHeight = 1
  private closest = 0
  private result: InscriptionId | null = null

  constructor(relief: Pick<CoverRelief, 'floor' | 'bevel'>) {
    this.trees = [treeFor(relief.floor), treeFor(relief.bevel)]
  }

  private intersectsBounds = (box: Box3) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    let behind = 0
    for (let i = 0; i < 8; i++) {
      const p = this.corner
        .set(
          i & 1 ? box.max.x : box.min.x,
          i & 2 ? box.max.y : box.min.y,
          i & 4 ? box.max.z : box.min.z,
          1,
        )
        .applyMatrix4(this.matrix)
      if (p.z + p.w < 0) {
        behind++
        continue
      }
      const x = (p.x / p.w) * this.halfWidth,
        y = (p.y / p.w) * this.halfHeight
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    // Reject wholly clipped nodes; a crossing needs triangle-level clipping.
    if (behind) return behind < 8
    const dx = Math.max(minX - this.pointer.x, 0, this.pointer.x - maxX)
    const dy = Math.max(minY - this.pointer.y, 0, this.pointer.y - maxY)
    return dx * dx + dy * dy <= this.closest
  }

  private intersectsTriangle = (triangle: Triangle) => {
    const { vertices, clipped, projected } = this
    vertices[0].set(triangle.a.x, triangle.a.y, triangle.a.z, 1).applyMatrix4(this.matrix)
    vertices[1].set(triangle.b.x, triangle.b.y, triangle.b.z, 1).applyMatrix4(this.matrix)
    vertices[2].set(triangle.c.x, triangle.c.y, triangle.c.z, 1).applyMatrix4(this.matrix)
    let count = 0
    for (let i = 0; i < 3; i++) {
      const a = vertices[i],
        b = vertices[(i + 1) % 3]
      const da = a.z + a.w,
        db = b.z + b.w
      if (da >= 0) clipped[count++].copy(a)
      if (da >= 0 !== db >= 0) clipped[count++].copy(a).lerp(b, da / (da - db))
    }
    for (let i = 0; i < count; i++) {
      const p = clipped[i]
      projected[i].set((p.x / p.w) * this.halfWidth, (p.y / p.w) * this.halfHeight)
    }
    for (let i = 1; i < count - 1; i++) {
      const distance = triangleDistanceSquared(
        this.pointer,
        projected[0],
        projected[i],
        projected[i + 1],
      )
      if (distance <= this.closest) {
        this.closest = distance
        this.result = subjectOf(triangle)
      }
    }
    return this.result !== null && this.closest === 0
  }

  pick(
    localToClip: Matrix4,
    pointerNdc: Vector2,
    viewport: { width: number; height: number },
    tolerance = ENGRAVING_HOVER_TOLERANCE,
  ): InscriptionId | null {
    this.matrix.copy(localToClip)
    this.halfWidth = viewport.width / 2
    this.halfHeight = viewport.height / 2
    this.pointer.set(pointerNdc.x * this.halfWidth, pointerNdc.y * this.halfHeight)
    this.closest = tolerance * tolerance
    this.result = null
    for (const tree of this.trees) {
      tree.shapecast({
        intersectsBounds: this.intersectsBounds,
        intersectsTriangle: this.intersectsTriangle,
      })
      if (this.result && this.closest === 0) break
    }
    return this.result
  }
}
