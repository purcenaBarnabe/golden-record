import { Info, Moon, Sun } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { ArtifactViewer } from './ArtifactViewer'
import { ExhibitPanels } from './ExhibitPanels'
import { IconButton } from '../ui/IconButton'
import { useGalleryTheme } from '../../hooks/use-gallery-theme'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { MusicExperience } from './MusicExperience'
import { useEffect, useState } from 'react'

export function Exhibit() {
  const { theme, toggleTheme } = useGalleryTheme()
  const setPanel = useExhibitStore((s) => s.setPanel)
  const mobileNavigationMode = useExhibitStore((s) => s.mobileNavigationMode)
  const setMobileNavigationMode = useExhibitStore((s) => s.setMobileNavigationMode)
  const [interactive, setInteractive] = useState(false)
  useEffect(() => setInteractive(true), [])
  return (
    <div className="gallery" data-theme={theme}>
      <a className="skip-link" href="#viewer-controls">
        Skip to inspection controls
      </a>
      <header className="gallery-header">
        <div className="gallery-title">
          <h1>The Golden Record</h1>
          <p>Voyager, 1977</p>
          <div className="mobile-navigation-modes" role="group" aria-label="Touch navigation">
            <button
              type="button"
              aria-pressed={mobileNavigationMode === 'orbit'}
              disabled={!interactive}
              onClick={() => setMobileNavigationMode('orbit')}
            >
              Orbit
            </button>
            <button
              type="button"
              aria-pressed={mobileNavigationMode === 'drag'}
              disabled={!interactive}
              onClick={() => setMobileNavigationMode('drag')}
            >
              Drag
            </button>
          </div>
        </div>
        <Tooltip.Provider delayDuration={200}>
          <nav aria-label="Exhibit options">
            <IconButton
              label="About this recreation"
              disabled={!interactive}
              onClick={() => setPanel('sources')}
            >
              <Info size={20} strokeWidth={1.7} />
            </IconButton>
            <IconButton
              label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              disabled={!interactive}
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <Moon size={20} strokeWidth={1.7} />
              ) : (
                <Sun size={20} strokeWidth={1.7} />
              )}
            </IconButton>
          </nav>
        </Tooltip.Provider>
      </header>
      <main aria-label="The Golden Record on a pedestal">
        <ArtifactViewer />
      </main>
      <ExhibitPanels />
      <MusicExperience />
    </div>
  )
}
