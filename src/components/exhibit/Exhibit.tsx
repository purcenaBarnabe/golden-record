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

export function Exhibit() {
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
        Skip to inspection controls
      </a>
      <header className="gallery-header">
        <div className="gallery-title">
          <h1>The Golden Record</h1>
          <p>Voyager, 1977</p>
          <SurfaceSwitch disabled={!viewerReady} />
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
        <ArtifactViewer ready={viewerReady} onReady={onViewerReady} />
      </main>
      <ExhibitPanels />
      <MusicExperience />
    </div>
  )
}
