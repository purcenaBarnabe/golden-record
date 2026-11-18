import { describe, expect, it } from 'vitest'
import { artworkPosition, inscriptionAtUv, inscriptions } from '../../src/lib/inscriptions'

describe('Artwork coordinates and picking', () => {
  it('maps the artwork center and corners into a meter-scale face', () => {
    expect(artworkPosition([0.5, 0.5], 0.1524)).toEqual([0, 0, 0.0018])
    expect(artworkPosition([0, 0], 0.1524)).toEqual([-0.1524, 0.1524, 0.0018])
    expect(artworkPosition([1, 1], 0.1524)).toEqual([0.1524, -0.1524, 0.0018])
  })
  it.each(inscriptions)(
    'picks $id at its inspection target, with the vertical UV axis flipped',
    ({ point: [u, v], id }) => {
      expect(inscriptionAtUv(u, 1 - v)?.id).toBe(id)
    },
  )
  it('prioritizes the hydrogen symbol over the large pulsar-map bounds', () => {
    expect(inscriptionAtUv(0.65, 0.15)?.id).toBe('hydrogen')
  })
  it('leaves positions outside all subject bounds unassigned', () => {
    expect(inscriptionAtUv(0.5, 0.95)).toBeUndefined()
    expect(inscriptionAtUv(0.95, 0.5)).toBeUndefined()
  })
})
