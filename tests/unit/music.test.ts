import { describe, expect, it } from 'vitest'
import { filterTracks, formatTime, recordTracks } from '../../src/lib/music'
import { onDisc } from '../../src/lib/surface-picking'
import { COVER_RADIUS } from '../../src/lib/artifact-dimensions'

describe('Voyager music program', () => {
  it('contains all 27 music selections in order, with four separate voice/sound segments', () => {
    const music = recordTracks.filter((track) => track.kind === 'music')
    expect(music).toHaveLength(27)
    expect(recordTracks.filter((track) => track.kind === 'voices')).toHaveLength(4)
    expect(music.map((track) => track.order)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1))
    expect(music[0].artist).toContain('Karl Richter')
    expect(music.at(-1)!.title).toContain('Cavatina')
    expect(new Set(recordTracks.map((track) => track.audio)).size).toBe(31)
  })
  it('maps every listed selection to the matching archival audio filename', () => {
    for (const track of recordTracks) {
      const url = new URL(track.audio)
      expect(url.hostname).toBe('archive.org')
      expect(decodeURIComponent(url.pathname)).toContain(
        `Track (${String(track.id).padStart(2, '0')}).mp3`,
      )
      expect(track.duration).toBeGreaterThan(0)
    }
  })
  it('finds performers, places and accented titles without requiring accents', () => {
    expect(filterTracks('music', 'chuck berry').map((track) => track.title)).toEqual([
      'Johnny B. Goode',
    ])
    expect(filterTracks('music', 'mugam')).toHaveLength(1)
    expect(filterTracks('music', 'china').map((track) => track.artist)).toEqual([
      'Guan Pinghu · Guqin',
    ])
    expect(filterTracks('voices', '55')).toHaveLength(1)
    expect(filterTracks('music', 'no matching selection')).toEqual([])
  })
  it('formats player time safely before audio metadata is available', () => {
    expect(formatTime(NaN)).toBe('0:00')
    expect(formatTime(-1)).toBe('0:00')
    expect(formatTime(283.9)).toBe('4:43')
  })
})

describe('Lightweight surface picking', () => {
  it('excludes the real spindle hole and the empty square corners', () => {
    expect(onDisc(0.5, 0.5, COVER_RADIUS)).toBe(false)
    expect(onDisc(0, 0, COVER_RADIUS)).toBe(false)
    expect(onDisc(0.95, 0.95, COVER_RADIUS)).toBe(false)
    expect(onDisc(0.35, 0.21, COVER_RADIUS)).toBe(true)
    expect(onDisc(0.7, 0.86, COVER_RADIUS)).toBe(true)
  })
})
