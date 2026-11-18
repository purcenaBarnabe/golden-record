import type { Locale } from './i18n/locale'
import { portugueseTracks } from './i18n/music.pt-BR'

export const NASA_MUSIC = 'https://science.nasa.gov/mission/voyager/golden-record-contents/sounds/'
export const AUDIO_ARCHIVE = 'https://archive.org/details/the-golden-voyager-record'
export const MUSIC_CREDITS = 'https://ozmarecords.com/pages/voyager'

export interface RecordTrack {
  id: number
  order: number
  kind: 'music' | 'voices'
  title: string
  artist: string
  place: string
  duration: number
  audio: string
}

// Music program/order: NASA. Performer names: Ozma's reissue documentation.
// Audio is streamed on request from the linked Internet Archive digitization;
// no recordings are bundled, fetched in advance, or copied to this site.
const entries: [string, string, string, number][] = [
  ['Greeting from the United Nations', 'Kurt Waldheim', 'United Nations', 43.76],
  ['Greetings in 55 languages', 'Voices from Earth', 'Around the world', 226.06],
  ['United Nations greetings & whale songs', 'Human and humpback whale voices', 'Earth', 244.14],
  ['The Sounds of Earth', 'Sound montage by Ann Druyan', 'Earth', 738.53],
  [
    'Brandenburg Concerto No. 2 · I. Allegro',
    'J. S. Bach · Munich Bach Orchestra / Karl Richter',
    'Germany',
    283.9,
  ],
  [
    'Puspåwårnå · Kinds of Flowers',
    'Pura Paku Alaman Palace Orchestra / K. R. T. Wasitodipuro',
    'Java, Indonesia',
    286.77,
  ],
  ['Cengunmé', 'Mahi musicians', 'Benin', 130.87],
  [
    'Alima Song',
    'Mbuti musicians of the Ituri Rainforest',
    'Democratic Republic of the Congo',
    60.79,
  ],
  ['Barnumbirr & Moikoi Song', 'Tom Djäwa, Mudpo & Waliparu', 'Australia', 89.47],
  ['El Cascabel', 'Antonio Maciel & Los Aguilillas · Mariachi México', 'Mexico', 199.92],
  ['Johnny B. Goode', 'Chuck Berry', 'United States', 160.55],
  [
    'Mariuamangɨ · Men’s house song',
    'Pranis Pandang & Kumbui, Nyaura clan',
    'Papua New Guinea',
    84.51,
  ],
  ['Sokaku-Reibo · Cranes in Their Nest', 'Goro Yamaguchi · Shakuhachi', 'Japan', 304.33],
  ['Gavotte en rondeau · Partita No. 3', 'J. S. Bach · Arthur Grumiaux', 'Germany', 177.66],
  [
    'The Magic Flute · Queen of the Night aria',
    'W. A. Mozart · Edda Moser / Wolfgang Sawallisch',
    'Austria',
    179.8,
  ],
  ['Chakrulo', 'Georgian State Ensemble / Anzor Kavsadze', 'Georgia', 138.63],
  ['Roncadoras and drums', 'Musicians from Ancash', 'Peru', 55.12],
  ['Melancholy Blues', 'Louis Armstrong & His Hot Seven', 'United States', 186.41],
  ['Muğam', 'Kamil Jalilov · Balaban', 'Azerbaijan', 154.64],
  [
    'The Rite of Spring · Sacrificial Dance',
    'Igor Stravinsky · Columbia Symphony Orchestra',
    'Russia',
    278.33,
  ],
  [
    'Prelude & Fugue No. 1 · Well-Tempered Clavier II',
    'J. S. Bach · Glenn Gould',
    'Germany',
    291.13,
  ],
  [
    'Symphony No. 5 · I. Allegro con brio',
    'L. van Beethoven · Philharmonia Orchestra / Otto Klemperer',
    'Germany',
    529.4,
  ],
  ['Izlel e Delyu Haydutin', 'Valya Balkanska', 'Bulgaria', 303.6],
  ['Navajo Night Chant', 'Ambrose Roan Horse, Chester Roan & Tom Roan', 'United States', 60.97],
  [
    'The Fairie Round',
    'Anthony Holborne · Early Music Consort / David Munrow',
    'United Kingdom',
    79.39,
  ],
  [
    'Naranaratana Kookokoo · Cry of the Megapode Bird',
    'Maniasinimae & Taumaetarau community',
    'Solomon Islands',
    75.34,
  ],
  ['Wedding Song', 'Young singer from Huancavelica · Recorded by John Cohen', 'Peru', 41.82],
  ['Liu Shui · Flowing Streams', 'Guan Pinghu · Guqin', 'China', 456.2],
  ['Bhairavi · Jaat Kahan Ho', 'Kesarbai Kerkar', 'India', 214.13],
  ['Dark Was the Night, Cold Was the Ground', 'Blind Willie Johnson', 'United States', 201.61],
  [
    'String Quartet No. 13 · Cavatina',
    'L. van Beethoven · Budapest String Quartet',
    'Germany',
    401.35,
  ],
]

export const recordTracks: RecordTrack[] = entries.map(([title, artist, place, duration], i) => ({
  id: i + 1,
  order: i < 4 ? i + 1 : i - 3,
  kind: i < 4 ? 'voices' : 'music',
  title,
  artist,
  place,
  duration,
  audio: `https://archive.org/download/the-golden-voyager-record/${encodeURIComponent(`NASA - The Golden Voyager Record - Track (${String(i + 1).padStart(2, '0')}).mp3`)}`,
}))

const localizedTracks: Record<Locale, RecordTrack[]> = {
  en: recordTracks,
  'pt-BR': recordTracks.map((track) => {
    const [title, artist, place] = portugueseTracks[track.id as keyof typeof portugueseTracks]
    return { ...track, title, artist, place }
  }),
}

export function localizeTrack(track: RecordTrack, locale: Locale): RecordTrack {
  return localizedTracks[locale].find((entry) => entry.id === track.id)!
}

export function formatTime(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
const searchable = new Map(
  recordTracks.map((track) => [
    track.id,
    normalize(
      [track, localizeTrack(track, 'pt-BR')]
        .map((entry) => `${entry.title} ${entry.artist} ${entry.place}`)
        .join(' '),
    ),
  ]),
)

export function filterTracks(kind: RecordTrack['kind'], query: string, locale: Locale = 'en') {
  const terms = normalize(query).trim().split(/\s+/)
  return localizedTracks[locale].filter(
    (track) =>
      track.kind === kind && terms.every((term) => searchable.get(track.id)!.includes(term)),
  )
}
