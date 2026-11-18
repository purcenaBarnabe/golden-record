export type Locale = 'en' | 'pt-BR'
export type LanguagePreference = Locale | 'auto'
export const LANGUAGE_STORAGE_KEY = 'voyager-language'

export function languagePreference(value: string | null): LanguagePreference {
  return value === 'en' || value === 'pt-BR' ? value : 'auto'
}

/** Follow the browser's BCP 47 preference order; English is the original fallback. */
export function resolveLocale(
  preference: LanguagePreference,
  languages: readonly string[],
): Locale {
  if (preference !== 'auto') return preference
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (base === 'pt') return 'pt-BR'
    if (base === 'en') return 'en'
  }
  return 'en'
}
