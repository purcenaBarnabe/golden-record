import { Languages } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { languagePreference } from '../../lib/i18n/locale'

export function LanguagePicker({ disabled }: { disabled: boolean }) {
  const { t, preference, setPreference } = useI18n()
  return (
    <label className="language-picker" title={t.language.label}>
      <Languages size={16} strokeWidth={1.7} aria-hidden="true" />
      <span className="language-code" aria-hidden="true">
        {t.language.short}
      </span>
      <select
        aria-label={t.language.label}
        value={preference}
        disabled={disabled}
        onChange={(event) => setPreference(languagePreference(event.target.value))}
      >
        <option value="auto">{t.language.auto}</option>
        <option value="en" lang="en">
          English
        </option>
        <option value="pt-BR" lang="pt-BR">
          Português (Brasil)
        </option>
      </select>
    </label>
  )
}
