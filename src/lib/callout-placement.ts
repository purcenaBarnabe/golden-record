export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}
export interface ScreenPoint {
  x: number
  y: number
}
export interface ProjectedSubject {
  subject: ScreenRect | null
  viewport: ScreenRect
  neighbors?: ScreenRect[]
  surface?: ScreenRect | null
  anchor?: ScreenPoint
}
export type CalloutSide = 'left' | 'right' | 'top' | 'bottom'
export type CalloutPlacement = ScreenRect & { side: CalloutSide }

export function overlapArea(a: ScreenRect, b: ScreenRect) {
  return (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  )
}
export function intersectRect(a: ScreenRect, b: ScreenRect): ScreenRect | null {
  const x = Math.max(a.x, b.x),
    y = Math.max(a.y, b.y)
  const width = Math.min(a.x + a.width, b.x + b.width) - x
  const height = Math.min(a.y + a.height, b.y + b.height) - y
  return width > 0 && height > 0 ? { x, y, width, height } : null
}
export function expandRect(rect: ScreenRect, gap: number): ScreenRect {
  return {
    x: rect.x - gap,
    y: rect.y - gap,
    width: rect.width + gap * 2,
    height: rect.height + gap * 2,
  }
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

/** Find free space around the entire projected figure, never merely its marker. */
export function placeCallout({
  subject,
  anchor,
  width,
  height,
  frame,
  obstacles = [],
  avoid = [],
  previous,
}: {
  subject: ScreenRect | null
  anchor: ScreenPoint
  width: number
  height: number
  frame: ScreenRect
  obstacles?: ScreenRect[]
  avoid?: ScreenRect[]
  previous?: CalloutPlacement | null
}): CalloutPlacement | null {
  if (width > frame.width || height > frame.height) return null
  const protectedRect = subject ? expandRect(subject, 16) : null
  const valid = (candidate: ScreenRect) =>
    candidate.x >= frame.x - 0.1 &&
    candidate.y >= frame.y - 0.1 &&
    candidate.x + width <= frame.x + frame.width + 0.1 &&
    candidate.y + height <= frame.y + frame.height + 0.1 &&
    (!protectedRect || overlapArea(candidate, protectedRect) === 0) &&
    obstacles.every((obstacle) => overlapArea(candidate, obstacle) === 0)
  const previousCandidate =
    previous && valid({ ...previous, width, height }) ? { ...previous, width, height } : null
  const r = protectedRect ?? { x: anchor.x, y: anchor.y, width: 0, height: 0 }
  const xs = [
    r.x + r.width,
    r.x - width,
    anchor.x - width / 2,
    frame.x,
    frame.x + frame.width - width,
  ]
  const ys = [
    anchor.y - height * 0.3,
    r.y - height,
    r.y + r.height,
    frame.y,
    frame.y + frame.height - height,
  ]
  // Free space beside the record is often between the subject and the window
  // edge. Include those positions explicitly instead of jumping to the edge.
  for (const region of [...avoid, ...obstacles]) {
    xs.push(region.x - width - 16, region.x + region.width + 16)
    ys.push(region.y - height - 16, region.y + region.height + 16)
  }
  const candidates: CalloutPlacement[] = []
  for (const rawX of xs)
    for (const rawY of ys) {
      const x = clamp(rawX, frame.x, frame.x + frame.width - width)
      const y = clamp(rawY, frame.y, frame.y + frame.height - height)
      const side: CalloutSide =
        x >= r.x + r.width - 0.1
          ? 'right'
          : x + width <= r.x + 0.1
            ? 'left'
            : y >= r.y + r.height - 0.1
              ? 'bottom'
              : 'top'
      const candidate = { x, y, width, height, side }
      if (valid(candidate)) candidates.push(candidate)
    }
  const distance = (rect: ScreenRect) =>
    Math.hypot(
      Math.max(rect.x - anchor.x, 0, anchor.x - rect.x - width),
      Math.max(rect.y - anchor.y, 0, anchor.y - rect.y - height),
    )
  const score = (rect: ScreenRect) =>
    distance(rect) + avoid.reduce((sum, region) => sum + overlapArea(rect, region), 0) / 15
  let best: CalloutPlacement | null = null
  let bestScore = Infinity
  for (const candidate of candidates) {
    const candidateScore = score(candidate)
    if (candidateScore < bestScore) {
      best = candidate
      bestScore = candidateScore
    }
  }
  // Retain small layout changes to prevent jitter, but release a distant old
  // position when resizing or camera motion creates substantially nearer space.
  if (previousCandidate && (!best || score(previousCandidate) <= bestScore + 24))
    return previousCandidate
  return best
}

/** A narrow safe path lets a reader reach a separated card at a slow pace. */
export function calloutCorridor(anchor: ScreenPoint, rect: ScreenRect) {
  const x = clamp(anchor.x, rect.x, rect.x + rect.width),
    y = clamp(anchor.y, rect.y, rect.y + rect.height)
  // The convex hull covers approaches to either edge of a diagonal card.
  // Choosing only its nearest vertical/horizontal edge leaves a dead wedge.
  const points = [
    { x: anchor.x - 9, y: anchor.y },
    { x: anchor.x + 9, y: anchor.y },
    { x: anchor.x, y: anchor.y - 9 },
    { x: anchor.x, y: anchor.y + 9 },
    { x: rect.x - 5, y: rect.y - 5 },
    { x: rect.x + rect.width + 5, y: rect.y - 5 },
    { x: rect.x - 5, y: rect.y + rect.height + 5 },
    { x: rect.x + rect.width + 5, y: rect.y + rect.height + 5 },
  ].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const halfHull = (input: ScreenPoint[]) => {
    const hull: ScreenPoint[] = []
    for (const point of input) {
      while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0)
        hull.pop()
      hull.push(point)
    }
    return hull.slice(0, -1)
  }
  const hull = [...halfHull(points), ...halfHull([...points].reverse())]
  return { edge: { x, y }, polygon: hull.map((point) => `${point.x},${point.y}`).join(' ') }
}
