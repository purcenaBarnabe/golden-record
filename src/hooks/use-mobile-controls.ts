import { useSyncExternalStore } from 'react'

const query = '(max-width: 600px), (max-height: 600px) and (pointer: coarse)'
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const getSnapshot = () => window.matchMedia(query).matches
const getServerSnapshot = () => false

export function useMobileControls() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
