export type InscriptionId =
  'playback' | 'stylus' | 'signal' | 'scan' | 'raster' | 'calibration' | 'pulsars' | 'hydrogen'

export interface Inscription {
  id: InscriptionId
  title: string
  category: string
  summary: string
  explanation: string
  fact: string
  unit: string
  // Normalized coordinates on the front face; origin at the upper left.
  point: [number, number]
  // Keep information markers beside the artwork without shifting inspection targets.
  markerPoint: [number, number]
  bounds: [number, number, number, number]
  crop: [number, number, number, number]
}

export const inscriptions: Inscription[] = [
  {
    id: 'playback',
    title: 'How to play a world',
    category: 'Record & rotation',
    summary: 'A record, a needle, and the speed at which Earth should be heard.',
    explanation:
      'The stylus begins at the outer edge. Binary marks specify one revolution every 3.6 seconds, equivalent to 16⅔ rpm.',
    fact: '16⅔',
    unit: 'revolutions per minute',
    point: [0.35, 0.21],
    markerPoint: [0.45, 0.3],
    bounds: [0.12, 0.14, 0.28, 0.29],
    crop: [0.1, 0.13, 0.31, 0.31],
  },
  {
    id: 'stylus',
    title: 'A needle’s-eye view',
    category: 'Stylus & duration',
    summary: 'The small side view explains how the supplied pickup meets the groove.',
    explanation:
      'This profile shows the cartridge resting on the disc. The binary inscription below gives approximately an hour of playing time per side.',
    fact: '≈ 1',
    unit: 'hour per side',
    point: [0.33, 0.51],
    markerPoint: [0.43, 0.52],
    bounds: [0.12, 0.47, 0.28, 0.11],
    crop: [0.1, 0.46, 0.31, 0.13],
  },
  {
    id: 'signal',
    title: 'Pictures hidden in sound',
    category: 'Video waveform',
    summary: 'The grooves carry image signals as well as sounds.',
    explanation:
      'The waveform identifies the start of a picture. Binary numbers mark the first three lines; each line lasts about eight milliseconds.',
    fact: '≈ 8',
    unit: 'milliseconds per line',
    point: [0.72, 0.2],
    markerPoint: [0.67, 0.12],
    bounds: [0.47, 0.14, 0.39, 0.15],
    crop: [0.46, 0.14, 0.41, 0.15],
  },
  {
    id: 'scan',
    title: 'Turning a signal into a line',
    category: 'Scan & interlace',
    summary: 'A repeated zigzag gives the order for reconstructing the image.',
    explanation:
      'The scan diagram specifies vertical lines and their staggered arrangement. It translates the waveform into a spatial instruction.',
    fact: 'Vertical',
    unit: 'image scanning',
    point: [0.78, 0.35],
    markerPoint: [0.91, 0.35],
    bounds: [0.58, 0.3, 0.28, 0.11],
    crop: [0.58, 0.3, 0.29, 0.12],
  },
  {
    id: 'raster',
    title: 'The architecture of an image',
    category: 'Picture raster',
    summary: 'A frame assembled one vertical line at a time.',
    explanation:
      'The rectangular raster specifies 512 vertical lines per complete image. Its arrows show how to build up the frame.',
    fact: '512',
    unit: 'lines in a complete picture',
    point: [0.73, 0.47],
    markerPoint: [0.8, 0.47],
    bounds: [0.59, 0.41, 0.16, 0.13],
    crop: [0.58, 0.4, 0.18, 0.15],
  },
  {
    id: 'calibration',
    title: 'First, make a circle',
    category: 'Calibration image',
    summary: 'A simple shape helps a distant reader check their work.',
    explanation:
      'The first decoded image should be a circle. An ellipse would reveal an incorrect width-to-height ratio.',
    fact: '1:1',
    unit: 'circle aspect ratio',
    point: [0.73, 0.61],
    markerPoint: [0.8, 0.61],
    bounds: [0.59, 0.55, 0.16, 0.13],
    crop: [0.58, 0.54, 0.18, 0.15],
  },
  {
    id: 'pulsars',
    title: 'Our return address',
    category: 'Pulsar map',
    summary: 'Fourteen cosmic clocks point back to the Sun.',
    explanation:
      'The radiating lines locate our solar system relative to 14 pulsars. Binary inscriptions record their periods, providing distinctive astronomical reference points.',
    fact: '14',
    unit: 'pulsars locate our Sun',
    point: [0.29, 0.72],
    markerPoint: [0.8, 0.75],
    bounds: [0.12, 0.58, 0.62, 0.38],
    crop: [0.11, 0.55, 0.63, 0.4],
  },
  {
    id: 'hydrogen',
    title: 'A universal measure',
    category: 'Hydrogen transition',
    summary: 'The simplest atom supplies a shared unit of time.',
    explanation:
      'Two spin states of hydrogen define the fundamental clock. Their transition provides the time unit used throughout the cover.',
    fact: '≈ 0.70',
    unit: 'nanoseconds per time unit',
    point: [0.7, 0.86],
    markerPoint: [0.79, 0.87],
    bounds: [0.6, 0.81, 0.16, 0.09],
    crop: [0.59, 0.8, 0.18, 0.11],
  },
]

export const NASA_COVER = 'https://science.nasa.gov/mission/voyager/golden-record-cover/'
export const NASA_MAKING = 'https://science.nasa.gov/mission/voyager/making-of-the-golden-record/'
export const NASA_OVERVIEW =
  'https://science.nasa.gov/mission/voyager/voyager-golden-record-overview/'

export function inscriptionAtUv(u: number, v: number): Inscription | undefined {
  // Subject ownership/layout metadata; surface activation first checks the cuts.
  // RingGeometry UVs increase upward, whereas artwork coordinates increase downward.
  let match: Inscription | undefined
  let smallestArea = Infinity
  const artworkY = 1 - v
  for (const item of inscriptions) {
    const [x, y, width, height] = item.bounds
    const area = width * height
    if (
      u >= x &&
      u <= x + width &&
      artworkY >= y &&
      artworkY <= y + height &&
      area < smallestArea
    ) {
      match = item
      smallestArea = area
    }
  }
  return match
}

export function artworkPosition(
  [u, v]: [number, number],
  radius: number,
): [number, number, number] {
  return [(u - 0.5) * radius * 2, (0.5 - v) * radius * 2, 0.0018]
}
