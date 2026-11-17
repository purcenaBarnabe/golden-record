import fs from 'node:fs/promises'
import { DOMParser } from '@xmldom/xmldom'
import ClipperLib from 'clipper-lib'
import { Color, ShapeUtils, Vector2 } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'

// SVGLoader reads inline CSS through the browser's element.style API. In Node,
// promote those declarations to SVG presentation attributes before parsing.
const previousDOMParser = globalThis.DOMParser
class PresentationDOMParser {
  parseFromString(text, type) {
    const document = new DOMParser().parseFromString(text, type)
    for (const node of Array.from(document.getElementsByTagName('*'))) {
      for (const declaration of (node.getAttribute('style') || '').split(';')) {
        const colon = declaration.indexOf(':')
        if (colon > 0)
          node.setAttribute(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim())
      }
    }
    return document
  }
}
const { Clipper, ClipperOffset, PolyTree, PolyType, ClipType, PolyFillType, JoinType, EndType } =
  ClipperLib
const SCALE = 100000
const METRES_PER_UNIT = 0.312 / 484
const DEPTH = 0.000045
const source = await fs.readFile('public/assets/cover-artwork.svg', 'utf8')
let paths
try {
  globalThis.DOMParser = PresentationDOMParser
  paths = new SVGLoader().parse(source).paths
} finally {
  if (previousDOMParser === undefined) delete globalThis.DOMParser
  else globalThis.DOMParser = previousDOMParser
}
let contours = [],
  pendingInk = []
const integerPath = (points) =>
  points.map(({ x, y }) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }))
function addPath(points, hole = false, target) {
  const path = integerPath(points)
  if (path.length < 3 || Math.abs(Clipper.Area(path)) < 1) return
  if (Clipper.Orientation(path) === hole) path.reverse()
  target.push(path)
}
function flushInk() {
  if (!pendingInk.length) return
  contours = Clipper.PolyTreeToPaths(clip([...contours, ...pendingInk], [], ClipType.ctUnion))
  pendingInk = []
}
function paint(paths, color) {
  if (!paths.length) return
  const rgb = new Color(color)
  if (rgb.r > 0.99 && rgb.g > 0.99 && rgb.b > 0.99) {
    // White is a paper knockout in the transcription. Respect SVG draw order:
    // restore metal below this fill, then engrave its outline and later details.
    flushInk()
    contours = Clipper.PolyTreeToPaths(clip(contours, paths, ClipType.ctDifference))
  } else pendingInk.push(...paths)
}
for (const path of paths) {
  const style = path.userData.style
  if (style.opacity === 0) continue
  if (style.fill !== 'none' && style.fillOpacity !== 0) {
    const fills = []
    for (const shape of SVGLoader.createShapes(path)) {
      const points = shape.extractPoints(48)
      addPath(points.shape, false, fills)
      points.holes.forEach((hole) => addPath(hole, true, fills))
    }
    paint(fills, style.fill)
  }
  if (style.stroke && style.stroke !== 'none' && style.strokeOpacity !== 0) {
    for (const curve of path.subPaths) {
      const geometry = SVGLoader.pointsToStroke(curve.getPoints(96), style, 12, 0.0001)
      if (!geometry) continue
      const p = geometry.attributes.position
      const triangles = []
      for (let i = 0; i < p.count; i += 3)
        addPath(
          [0, 1, 2].map((j) => ({ x: p.getX(i + j), y: p.getY(i + j) })),
          false,
          triangles,
        )
      // Consolidate each stroke before the global boolean. Feeding thousands
      // of overlapping stroke triangles into one operation is needlessly slow.
      paint(
        Clipper.CleanPolygons(
          Clipper.PolyTreeToPaths(clip(triangles, [], ClipType.ctUnion)),
          SCALE * 0.0005,
        ),
        style.stroke,
      )
      geometry.dispose()
    }
  }
}
flushInk()
function clip(subject, clips, operation) {
  const engine = new Clipper()
  engine.AddPaths(subject, PolyType.ptSubject, true)
  if (clips.length) engine.AddPaths(clips, PolyType.ptClip, true)
  const tree = new PolyTree()
  engine.Execute(operation, tree, PolyFillType.pftNonZero, PolyFillType.pftNonZero)
  return tree
}
const cutTree = clip(contours, [], ClipType.ctUnion)
const cuts = Clipper.PolyTreeToPaths(cutTree)
console.log(`Consolidated ${paths.length} SVG paths into ${cuts.length} cut contours.`)
function circle(radius, count, reverse = false) {
  const points = Array.from({ length: count }, (_, i) => ({
    X: Math.round((359 + (Math.cos((i / count) * Math.PI * 2) * radius) / METRES_PER_UNIT) * SCALE),
    Y: Math.round((512 + (Math.sin((i / count) * Math.PI * 2) * radius) / METRES_PER_UNIT) * SCALE),
  }))
  if (reverse) points.reverse()
  return points
}
const disc = [circle(0.156 - 0.00004, 1536), circle(0.0036, 192, true)]
const faceTree = clip(disc, cuts, ClipType.ctDifference)
function inset(paths, amount) {
  const offset = new ClipperOffset(3, 0.0005 * SCALE)
  offset.AddPaths(paths, JoinType.jtRound, EndType.etClosedPolygon)
  const result = []
  offset.Execute(result, -amount * SCALE)
  return result
}
const inner = inset(cuts, 0.07)
const floorTree = clip(inner, [], ClipType.ctUnion)
function triangulate(tree, heightAt) {
  const positions = [],
    normals = [],
    uvs = []
  function visit(node) {
    if (node.Contour().length && !node.IsHole()) {
      const outline = node.Contour()
      const holes = node
        .Childs()
        .filter((child) => child.IsHole())
        .map((child) => child.Contour())
      const all = [outline, ...holes].flat()
      const triangles = ShapeUtils.triangulateShape(
        outline.map((p) => new Vector2(p.X, -p.Y)),
        holes.map((h) => h.map((p) => new Vector2(p.X, -p.Y))),
      )
      for (const triangle of triangles) {
        const vertices = triangle.map((i) => {
          const p = all[i],
            x = p.X / SCALE,
            y = p.Y / SCALE
          return [(x - 359) * METRES_PER_UNIT, (512 - y) * METRES_PER_UNIT, heightAt(p)].map(
            Math.fround,
          )
        })
        const [a, b, c] = vertices
        const u = b.map((v, i) => v - a[i]),
          v = c.map((w, i) => w - a[i])
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        const length = Math.hypot(...n)
        if (length < 1e-18) continue
        if (n[2] < 0) {
          vertices.reverse()
          n.forEach((_, i) => (n[i] *= -1))
        }
        for (const vertex of vertices) {
          positions.push(...vertex)
          normals.push(...n.map((q) => q / length))
          uvs.push(vertex[0] / 0.312 + 0.5, vertex[1] / 0.312 + 0.5)
        }
      }
    }
    node.Childs().forEach(visit)
  }
  visit(tree)
  return { positions, normals, uvs }
}
// Three facets round the lip and floor transitions, while preserving a steeper
// central cut wall. The total depth and original outline remain unchanged.
const rings = [cuts, inset(cuts, 0.018), inset(cuts, 0.052), inner]
const depths = [0, -0.000005, -0.000039, -DEPTH]
const bevel = { positions: [], normals: [], uvs: [] }
for (let i = 0; i < rings.length - 1; i++) {
  const vertices = new Set(rings[i + 1].flatMap((p) => p.map(({ X, Y }) => `${X},${Y}`)))
  const band = triangulate(clip(rings[i], rings[i + 1], ClipType.ctDifference), (p) =>
    vertices.has(`${p.X},${p.Y}`) ? depths[i + 1] : depths[i],
  )
  for (const attribute of ['positions', 'normals', 'uvs'])
    bevel[attribute] = bevel[attribute].concat(band[attribute])
}
const original = [triangulate(faceTree, () => 0), bevel, triangulate(floorTree, () => -DEPTH)]
function indexGeometry(geometry, smooth) {
  const result = { positions: [], normals: [], uvs: [], indices: [] },
    seen = new Map()
  for (let i = 0; i < geometry.positions.length / 3; i++) {
    const p = geometry.positions.slice(i * 3, i * 3 + 3)
    const n = geometry.normals.slice(i * 3, i * 3 + 3)
    const key = (smooth ? p : [...p, ...n.map((v) => Math.round(v * 1e6))]).join(',')
    const candidates = seen.get(key) ?? []
    let index = candidates.find((candidate) => {
      if (!smooth) return true
      const a = result.normals.slice(candidate * 3, candidate * 3 + 3)
      return (
        a.reduce((sum, v, j) => sum + v * n[j], 0) / Math.hypot(...a) >
        Math.cos((35 * Math.PI) / 180)
      )
    })
    if (index === undefined) {
      index = result.positions.length / 3
      candidates.push(index)
      seen.set(key, candidates)
      result.positions.push(...p)
      result.normals.push(...n)
      result.uvs.push(...geometry.uvs.slice(i * 2, i * 2 + 2))
    } else if (smooth) for (let j = 0; j < 3; j++) result.normals[index * 3 + j] += n[j]
    result.indices.push(index)
  }
  if (smooth)
    for (let i = 0; i < result.normals.length; i += 3) {
      const length = Math.hypot(...result.normals.slice(i, i + 3))
      for (let j = 0; j < 3; j++) result.normals[i + j] /= length
    }
  return result
}
const geometries = original.map((geometry, i) => indexGeometry(geometry, i === 1))
const counts = geometries.map((g) => g.positions.length / 3)
const header = new Uint32Array([
  0x47524356,
  2,
  ...counts,
  ...geometries.map((g) => g.indices.length),
])
const chunks = [Buffer.from(header.buffer)]
for (const geometry of geometries) {
  for (const name of ['positions', 'normals', 'uvs'])
    chunks.push(Buffer.from(new Float32Array(geometry[name]).buffer))
  chunks.push(Buffer.from(new Uint32Array(geometry.indices).buffer))
}
const buffer = Buffer.concat(chunks)
const triangles = geometries.reduce((sum, g) => sum + g.indices.length / 3, 0)
await fs.writeFile('public/assets/cover-relief.bin', buffer)
await fs.writeFile(
  'public/assets/cover-relief.json',
  JSON.stringify(
    {
      version: 2,
      depthMetres: DEPTH,
      bevelWidthMetres: 0.07 * METRES_PER_UNIT,
      bevelFacets: 3,
      vertices: counts,
      triangles,
      indexedBytes: buffer.length,
      unindexedBytes: original.reduce((sum, g) => sum + (g.positions.length / 3) * 32, 32),
      source: 'cover-artwork.svg',
    },
    null,
    2,
  ) + '\n',
)
console.log(
  `Built recessed cover: ${triangles} triangles, three-facet walls, ${DEPTH * 1e6} µm estimated depth, ${(buffer.length / 1048576).toFixed(2)} MiB.`,
)
