import { FileLoader, Loader, LoadingManager } from 'three'
import { canDecodeCoverPackage, decodeCoverPackage } from './cover-package'
import { parseCoverRelief, type CoverRelief } from './engraved-cover'
import { RAW_COVER_RELIEF_URL } from './exhibit-assets'

export async function unpackCoverRelief(data: ArrayBuffer) {
  let buffer = data
  const signature = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength))
  if (signature[0] === 0x1f && signature[1] === 0x8b) {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
    buffer = await new Response(stream).arrayBuffer()
  }
  return parseCoverRelief(await decodeCoverPackage(buffer))
}

export class EngravedCoverLoader extends Loader<CoverRelief> {
  load(
    url: string,
    onLoad: (relief: CoverRelief) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (error: unknown) => void,
  ) {
    // The logical resource stays pending through decompression and validation,
    // not merely until its network response finishes.
    this.manager.itemStart(url)
    const complete = (relief: CoverRelief) => {
      onLoad(relief)
      this.manager.itemEnd(url)
    }
    const failed = (error: unknown) => {
      onError?.(error)
      this.manager.itemError(url)
      this.manager.itemEnd(url)
    }
    const file = () =>
      new FileLoader(new LoadingManager()).setPath(this.path).setResponseType('arraybuffer')
    // Keep the original geometry available when native gzip or WASM is unavailable.
    const fallback = () =>
      file().load(
        RAW_COVER_RELIEF_URL,
        (data) => {
          try {
            complete(parseCoverRelief(data as ArrayBuffer))
          } catch (error) {
            failed(error)
          }
        },
        onProgress,
        failed,
      )
    if (typeof DecompressionStream === 'undefined') fallback()
    else
      canDecodeCoverPackage().then((supported) => {
        if (!supported) fallback()
        else
          file().load(
            url,
            (data) => {
              unpackCoverRelief(data as ArrayBuffer).then(complete, fallback)
            },
            onProgress,
            fallback,
          )
      })
  }
}
