import { describe, expect, it } from 'vitest'
import {
  calloutCorridor,
  overlapArea,
  placeCallout,
  type ScreenRect,
} from '../../src/lib/callout-placement'

const frame = { x: 12, y: 85, width: 1416, height: 795 }
const size = { width: 228, height: 214 }
const anchor = { x: 720, y: 400 }
describe('Subject-aware information cards', () => {
  it.each<ScreenRect>([
    { x: 580, y: 200, width: 220, height: 250 },
    { x: 900, y: 400, width: 390, height: 200 },
    { x: 20, y: 650, width: 600, height: 150 },
    { x: 10, y: 90, width: 1420, height: 180 },
  ])('keeps the card entirely outside a projected subject', (subject) => {
    const result = placeCallout({ subject, anchor, ...size, frame })!
    expect(result).not.toBeNull()
    expect(overlapArea(result, subject)).toBe(0)
    expect(result.x).toBeGreaterThanOrEqual(frame.x)
    expect(result.y).toBeGreaterThanOrEqual(frame.y)
    expect(result.x + result.width).toBeLessThanOrEqual(frame.x + frame.width)
    expect(result.y + result.height).toBeLessThanOrEqual(frame.y + frame.height)
  })
  it('chooses space below a phone-sized subject instead of covering it', () => {
    const subject = { x: 40, y: 140, width: 310, height: 300 }
    const result = placeCallout({
      subject,
      anchor: { x: 195, y: 280 },
      width: 205,
      height: 210,
      frame: { x: 12, y: 85, width: 366, height: 639 },
    })!
    expect(result.side).toBe('bottom')
    expect(overlapArea(result, subject)).toBe(0)
  })
  it('requests a separate reading rail when the subject fills the view', () => {
    expect(
      placeCallout({ subject: { x: 0, y: 0, width: 1440, height: 1000 }, anchor, ...size, frame }),
    ).toBeNull()
  })
  it('preserves an existing clear position and avoids the gallery controls', () => {
    const subject = { x: 500, y: 200, width: 300, height: 300 }
    const initial = placeCallout({ subject, anchor, ...size, frame })!
    const previous = { ...initial, y: initial.y + 8 }
    expect(placeCallout({ subject, anchor, ...size, frame, previous })).toEqual(previous)
    const obstacle = { ...previous }
    const result = placeCallout({
      subject,
      anchor,
      ...size,
      frame,
      previous,
      obstacles: [obstacle],
    })!
    expect(overlapArea(result, obstacle)).toBe(0)
    expect(overlapArea(result, subject)).toBe(0)
  })
  it('uses the space immediately beside a record instead of a distant window edge', () => {
    const surface = { x: 540, y: -180, width: 730, height: 950 }
    const subject = { x: 650, y: 200, width: 220, height: 80 }
    const options = {
      subject,
      anchor: { x: 795, y: 237 },
      width: 228,
      height: 228,
      frame: { x: 12, y: 85, width: 1976, height: 551 },
      avoid: [surface],
    }
    const result = placeCallout(options)!
    expect(surface.x - result.x - result.width).toBe(16)
    expect(result.x).toBeGreaterThan(200)
    expect(overlapArea(result, subject)).toBe(0)
    const oldEdgePosition = { x: 12, y: result.y, width: 228, height: 228, side: 'left' as const }
    expect(placeCallout({ ...options, previous: oldEdgePosition })).toEqual(result)
  })
  it('provides a safe path from the marker to a separated card', () => {
    const path = calloutCorridor({ x: 400, y: 300 }, { x: 600, y: 200, width: 228, height: 214 })
    expect(path.edge).toEqual({ x: 600, y: 300 })
    expect(path.polygon).toContain('400,291')
    expect(path.polygon).toContain('595,195')
  })
  it('keeps diagonal approaches safe even when they enter a different edge than the nearest one', () => {
    const anchor = { x: 628, y: 452 },
      rect = { x: 306, y: 586, width: 228, height: 222 }
    const polygon = calloutCorridor(anchor, rect)
      .polygon.split(' ')
      .map((point) => point.split(',').map(Number))
    for (const target of [
      [rect.x + 1, rect.y + 1],
      [rect.x + rect.width - 1, rect.y + 1],
      [rect.x + rect.width / 2, rect.y + rect.height / 2],
    ]) {
      for (let step = 1; step <= 10; step++) {
        const p = [
          anchor.x + ((target[0] - anchor.x) * step) / 10,
          anchor.y + ((target[1] - anchor.y) * step) / 10,
        ]
        const sides = polygon.map((a, i) => {
          const b = polygon[(i + 1) % polygon.length]
          return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
        })
        expect(sides.every((side) => side >= -0.001) || sides.every((side) => side <= 0.001)).toBe(
          true,
        )
      }
    }
  })
})
