import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import './welcome-celebration.css'

const STORAGE_KEY = 'voyager-welcome-seen'
const DURATION = 10000
const EXIT_DURATION = 600

// One bounded burst. Positions are deterministic; nothing runs on each frame.
const confetti = Array.from({ length: 36 }, (_, index) => {
  const angle = (Math.PI * (index + 0.5)) / 36
  const reach = 0.6 + ((index * 7) % 11) / 20
  return {
    '--x': Math.cos(angle) * reach,
    '--y': -Math.sin(angle) * reach,
    '--drift': ((index % 5) - 2) * 18 + 'px',
    '--turn': `${(index % 2 ? 1 : -1) * (240 + (index % 4) * 90)}deg`,
    '--delay': `${650 + (index % 6) * 75}ms`,
    '--duration': `${4400 + (index % 5) * 220}ms`,
    '--color': ['#c5a45a', '#d897a3', '#8ba99b', '#91acbf', '#ccbce0'][index % 5],
  } as CSSProperties
})

export function WelcomeCelebration({ viewerReady }: { viewerReady: boolean }) {
  const { t } = useI18n()
  const checked = useRef(false)
  const container = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'idle' | 'open' | 'closing' | 'closed'>('idle')
  const dismiss = useCallback(() => {
    setPhase((current) => (current === 'open' ? 'closing' : current))
  }, [])

  useEffect(() => {
    // Start at hydration, independently of scene downloads, decoding, and WebGL.
    if (checked.current) return
    checked.current = true
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // The welcome still works for this visit when storage is blocked or full.
    }
    setPhase('open')
  }, [])

  useEffect(() => {
    if (phase !== 'open') return
    const timeout = window.setTimeout(dismiss, DURATION)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    const onInteraction = (event: Event) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) dismiss()
    }
    // The overlay never blocks the exhibit or takes focus. Starting to explore
    // also dismisses it, while letting the original click/key action through.
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onInteraction, { capture: true, passive: true })
    document.addEventListener('focusin', onInteraction)
    return () => {
      window.clearTimeout(timeout)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onInteraction, true)
      document.removeEventListener('focusin', onInteraction)
    }
  }, [phase, dismiss])

  useEffect(() => {
    if (phase !== 'closing') return
    if (container.current?.contains(document.activeElement))
      document.getElementById('viewer-controls')?.focus({ preventScroll: true })
    const timeout = window.setTimeout(() => setPhase('closed'), EXIT_DURATION)
    return () => window.clearTimeout(timeout)
  }, [phase])

  if (phase === 'idle' || phase === 'closed') return null

  return (
    <div
      ref={container}
      className="welcome-celebration"
      data-loading={!viewerReady || undefined}
      data-closing={phase === 'closing' || undefined}
      inert={phase === 'closing' || undefined}
    >
      <div className="welcome-confetti" aria-hidden="true">
        {confetti.map((style, index) => (
          <i key={index} style={style} />
        ))}
      </div>
      <button
        type="button"
        className="welcome-close icon-button"
        aria-label={t.welcome.close}
        onClick={dismiss}
      >
        <X size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="welcome-content">
        <img
          className="welcome-voyager"
          src="/assets/voyager-party.svg"
          width="520"
          height="420"
          alt={t.welcome.voyager}
          fetchPriority="high"
          draggable={false}
        />
        <div className="welcome-message" aria-live="polite">
          <h2>{t.welcome.title}</h2>
          <p>{t.welcome.description}</p>
        </div>
        <a
          className="welcome-source"
          href="https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/"
          target="_blank"
          rel="noopener noreferrer"
          hrefLang="en"
        >
          {t.welcome.source}
        </a>
        <button type="button" className="welcome-explore" onClick={dismiss}>
          {t.welcome.explore}
        </button>
      </div>
    </div>
  )
}
