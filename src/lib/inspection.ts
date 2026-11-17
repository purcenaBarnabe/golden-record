import { ARTIFACT_CENTER_Y, COVER_FACE_Z, RECORD_THICKNESS } from './artifact-dimensions'

export const MIN_ZOOM = 0.7
export const MAX_ZOOM = 128
export const ENGRAVING_ZOOM = 18
export const TEXTURE_ZOOM = 96
export const AUTO_HOVER_MAX_ZOOM = 32
export const SURFACE_FOCUS = {
  'cover-texture': [-0.018, ARTIFACT_CENTER_Y + 0.018, COVER_FACE_Z],
  'record-texture': [-0.104, ARTIFACT_CENTER_Y, -RECORD_THICKNESS / 2],
} as const

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}
