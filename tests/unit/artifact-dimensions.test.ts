import { expect, it } from 'vitest'
import {
  BOND_THICKNESS,
  COPPER_LAYER_THICKNESS,
  RECORD_RADIUS,
  RECORD_THICKNESS,
} from '../../src/lib/artifact-dimensions'

it('models the documented 12-inch disc and 0.050-inch bonded construction in meters', () => {
  expect(RECORD_RADIUS * 2).toBeCloseTo(12 * 0.0254, 8)
  expect(RECORD_THICKNESS).toBeCloseTo(0.05 * 0.0254, 8)
  expect(COPPER_LAYER_THICKNESS * 2 + BOND_THICKNESS).toBeCloseTo(RECORD_THICKNESS, 8)
})
