import { useEffect, useRef } from 'react'
import { useExhibitStore } from '../stores/use-exhibit-store'

export function useGalleryTheme() {
  const theme = useExhibitStore((s) => s.theme)
  const setTheme = useExhibitStore((s) => s.setTheme)
  const manual = useRef(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    let saved: string | null = null
    try {
      saved = localStorage.getItem('voyager-theme')
    } catch {
      /* Storage is optional. */
    }
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved)
      manual.current = true
    } else setTheme(media.matches ? 'dark' : 'light')
    const update = () => {
      if (!manual.current) setTheme(media.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [setTheme])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
  }, [theme])
  return {
    theme,
    toggleTheme: () => {
      const next = theme === 'light' ? 'dark' : 'light'
      manual.current = true
      setTheme(next)
      try {
        localStorage.setItem('voyager-theme', next)
      } catch {
        /* Storage is optional. */
      }
    },
  }
}
