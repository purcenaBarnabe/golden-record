import { SPINDLE_RADIUS } from './artifact-dimensions'

/** UVs on a square inspection plane, matched to the circular metal face. */
export function onDisc(u: number, v: number, radius: number) {
  const distance = Math.hypot(u - 0.5, v - 0.5) * radius * 2
  return distance >= SPINDLE_RADIUS && distance <= radius
}
