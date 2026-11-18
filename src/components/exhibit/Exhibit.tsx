import { Info, Moon, Sun } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ArtifactViewer } from './ArtifactViewer'
import { ExhibitPanels } from './ExhibitPanels'
import { IconButton } from '../ui/IconButton'
import { useGalleryTheme } from '../../hooks/use-gallery-theme'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { MusicExperience } from './MusicExperience'
import { SurfaceSwitch } from './SurfaceSwitch'
import { useCallback, useEffect, useState } from 'react'
import { observeExhibit } from '../../lib/exhibit-observability'
import { useI18n } from '../../lib/i18n'
import { LanguagePicker } from './LanguagePicker'
import { WelcomeCelebration } from './WelcomeCelebration'

export function Exhibit() {
  const { t } = useI18n()
  const { theme, toggleTheme } = useGalleryTheme()
  const setPanel = useExhibitStore((s) => s.setPanel)
  const [interactive, setInteractive] = useState(false)
  const [viewerReady, setViewerReady] = useState(false)
  const onViewerReady = useCallback(() => setViewerReady(true), [])
  useEffect(() => setInteractive(true), [])
  useEffect(observeExhibit, [])
  return (
    <div className="gallery" data-theme={theme}>
      <a className="skip-link" href="#viewer-controls">
        {t.exhibit.skip}
      </a>
      <header className="gallery-header">
        <div className="gallery-title">
          <h1>{t.title}</h1>
          <p>Voyager, 1977</p>
          <SurfaceSwitch disabled={!viewerReady} />
        </div>
        <Tooltip.Provider delayDuration={200}>
          <nav aria-label={t.exhibit.options}>
            <IconButton
              label={t.exhibit.about}
              disabled={!interactive}
              onClick={() => setPanel('sources')}
            >
              <Info size={20} strokeWidth={1.7} />
            </IconButton>
            <IconButton
              label={theme === 'light' ? t.exhibit.dark : t.exhibit.light}
              disabled={!interactive}
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <Moon size={20} strokeWidth={1.7} />
              ) : (
                <Sun size={20} strokeWidth={1.7} />
              )}
            </IconButton>
            <LanguagePicker disabled={!interactive} />
          </nav>
        </Tooltip.Provider>
      </header>
      <main aria-label={t.exhibit.main}>
        <ArtifactViewer ready={viewerReady} onReady={onViewerReady} />
      </main>
      <ExhibitPanels />
      <MusicExperience />
      <WelcomeCelebration viewerReady={viewerReady} />
    </div>
  )
}
