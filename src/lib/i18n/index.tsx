import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { en, type Messages } from './en'
import { ptBR } from './pt-BR'
import { I18nContext } from './context'
import {
  LANGUAGE_STORAGE_KEY,
  languagePreference,
  resolveLocale,
  type LanguagePreference,
  type Locale,
} from './locale'

export { useI18n } from './context'

const catalogs: Record<Locale, Messages> = { en, 'pt-BR': ptBR }
const browserLanguages = () =>
  navigator.languages?.length ? [...navigator.languages] : [navigator.language]

export function LocaleProvider({ children }: { children: ReactNode }) {
  // A deterministic first render matches the prerendered English document.
  const [preference, setPreferenceState] = useState<LanguagePreference>('auto')
  const [languages, setLanguages] = useState<string[]>([])
  useEffect(() => {
    setLanguages(browserLanguages())
    try {
      setPreferenceState(languagePreference(localStorage.getItem(LANGUAGE_STORAGE_KEY)))
    } catch {
      /* Browser preferences still work when storage is unavailable. */
    }
    const onLanguageChange = () => setLanguages(browserLanguages())
    const onStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null)
        setPreferenceState(languagePreference(event.newValue))
    }
    window.addEventListener('languagechange', onLanguageChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('languagechange', onLanguageChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
  const setPreference = useCallback((value: LanguagePreference) => {
    setPreferenceState(value)
    try {
      if (value === 'auto') localStorage.removeItem(LANGUAGE_STORAGE_KEY)
      else localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
    } catch {
      /* A manual choice remains usable for the current visit. */
    }
  }, [])
  const locale = resolveLocale(preference, languages)
  return (
    <I18nContext.Provider
      value={{
        locale,
        preference,
        setPreference,
        t: catalogs[locale],
        number: (value, options) => new Intl.NumberFormat(locale, options).format(value),
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}
