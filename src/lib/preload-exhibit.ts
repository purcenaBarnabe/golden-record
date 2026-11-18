import { useLoader } from '@react-three/fiber'
import { LoadingManager, TextureLoader } from 'three'
import { EngravedCoverLoader } from './cover-loader'
import { COVER_RELIEF_URL, RECORD_TEXTURE_URLS } from './exhibit-assets'

let prepared: Promise<void> | undefined

/** Fill the existing R3F loader cache after WebGL succeeds, before scene mount. */
export function prepareExhibitAssets() {
  return (prepared ??= new Promise<void>((resolve, reject) => {
    const manager = new LoadingManager(resolve, undefined, (url) =>
      reject(new Error(`Unable to load ${url}`)),
    )
    useLoader.preload(EngravedCoverLoader, COVER_RELIEF_URL, (loader) => {
      loader.manager = manager
    })
    useLoader.preload(TextureLoader, RECORD_TEXTURE_URLS, (loader) => {
      loader.manager = manager
    })
  }))
}
