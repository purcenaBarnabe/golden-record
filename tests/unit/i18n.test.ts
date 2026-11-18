import { describe, expect, it } from 'vitest'
import { en } from '../../src/lib/i18n/en'
import { ptBR } from '../../src/lib/i18n/pt-BR'
import { languagePreference, resolveLocale } from '../../src/lib/i18n/locale'
import { inscriptions } from '../../src/lib/inscriptions'
import { filterTracks, localizeTrack, recordTracks } from '../../src/lib/music'

function messageShape(catalog: object, prefix = ''): string[] {
  return Object.entries(catalog)
    .flatMap(([key, value]) => {
      const path = `${prefix}${key}`
      if (typeof value === 'object') return messageShape(value, `${path}.`)
      expect(
        typeof value === 'string' ? value.trim().length : typeof value === 'function',
      ).toBeTruthy()
      return `${path}:${typeof value}`
    })
    .sort()
}

describe('language negotiation', () => {
  it.each([
    [['pt-BR', 'en-US'], 'pt-BR'],
    [['pt'], 'pt-BR'],
    [['pt-PT', 'en'], 'pt-BR'],
    [['PT-br'], 'pt-BR'],
    [['en-GB', 'pt-BR'], 'en'],
    [['fr-FR', 'pt-BR', 'en-US'], 'pt-BR'],
    [['fr-FR', 'en-US', 'pt-BR'], 'en'],
    [['fr-FR', 'de-DE'], 'en'],
    [[], 'en'],
  ] as const)('follows browser preference order %j', (languages, expected) => {
    expect(resolveLocale('auto', languages)).toBe(expected)
  })
  it('gives an explicit choice precedence over browser preferences', () => {
    expect(resolveLocale('en', ['pt-BR'])).toBe('en')
    expect(resolveLocale('pt-BR', ['en-US'])).toBe('pt-BR')
  })
  it('ignores missing, unsupported or obsolete saved preferences', () => {
    for (const value of [null, '', 'auto', 'fr', 'obsolete'])
      expect(languagePreference(value)).toBe('auto')
    expect(languagePreference('en')).toBe('en')
    expect(languagePreference('pt-BR')).toBe('pt-BR')
  })
})

describe('translation coverage', () => {
  it('provides the same complete, nonempty catalog in both languages', () => {
    expect(messageShape(ptBR)).toEqual(messageShape(en))
    expect(Object.keys(ptBR.inscriptions).sort()).toEqual(
      inscriptions.map((item) => item.id).sort(),
    )
    for (const item of inscriptions) {
      const copy = ptBR.inscriptions[item.id]
      expect(copy.category).not.toBe(item.category)
      expect(copy.summary).not.toBe(item.summary)
      expect(copy.explanation).not.toBe(item.explanation)
    }
    expect(ptBR.inscriptions.hydrogen.fact).toBe('≈ 0,70')
  })
  it('preserves the archive mapping and playback data for every localized recording', () => {
    for (const track of recordTracks) {
      const translated = localizeTrack(track, 'pt-BR')
      expect(translated).toMatchObject({
        id: track.id,
        order: track.order,
        kind: track.kind,
        duration: track.duration,
        audio: track.audio,
      })
      expect(translated.title.trim()).not.toBe('')
      expect(translated.artist.trim()).not.toBe('')
      expect(translated.place.trim()).not.toBe('')
    }
    expect(localizeTrack(recordTracks[10], 'pt-BR').title).toBe('Johnny B. Goode')
    expect(localizeTrack(recordTracks[10], 'en')).toBe(recordTracks[10])
  })
  it('searches translated and original titles, places and credits without accents', () => {
    expect(filterTracks('music', 'estados unidos', 'pt-BR').map((track) => track.id)).toEqual([
      11, 18, 24, 30,
    ])
    expect(filterTracks('music', 'sagracao primavera', 'pt-BR')[0].id).toBe(20)
    expect(filterTracks('music', 'rite spring', 'pt-BR')[0].title).toBe(
      'A Sagração da Primavera · Dança Sacrificial',
    )
    expect(filterTracks('music', 'japao', 'en')[0].place).toBe('Japan')
    expect(filterTracks('music', 'orquestra munique', 'pt-BR')[0].id).toBe(5)
    expect(filterTracks('voices', 'saudacoes', 'pt-BR')).toHaveLength(2)
  })
})
