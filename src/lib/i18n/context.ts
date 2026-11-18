import { createContext, useContext } from 'react'
import type { Messages } from './en'
import type { LanguagePreference, Locale } from './locale'

interface I18n {
  locale: Locale
  preference: LanguagePreference
  setPreference: (preference: LanguagePreference) => void
  t: Messages
  number: (value: number, options?: Intl.NumberFormatOptions) => string
}

// Keep context identity stable when a translation catalog is hot-reloaded.
export const I18nContext = createContext<I18n | null>(null)

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n requires LocaleProvider')
  return context
}
