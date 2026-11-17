import { BookOpen, Info, Moon, Sun } from 'lucide-react'
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
        </div>
        <Tooltip.Provider delayDuration={200}>
          <nav aria-label="Exhibit options">
            <IconButton
              label="Explore the engravings"
              disabled={!interactive}
              onClick={() => setPanel('inscriptions')}
            >
              <BookOpen size={18} strokeWidth={1.4} />
            </IconButton>
            <IconButton
              label="About this recreation"
              disabled={!interactive}
              onClick={() => setPanel('sources')}
            >
              <Info size={18} strokeWidth={1.4} />
            </IconButton>
            <IconButton
              label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              disabled={!interactive}
              onClick={toggleTheme}
            >
              {theme === 'light' ? (
                <Moon size={18} strokeWidth={1.4} />
              ) : (
                <Sun size={18} strokeWidth={1.4} />
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
