import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  ArrowUpRight,
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Search,
  SkipBack,
  SkipForward,
  Volume2,
  X,
} from 'lucide-react'
import {
  AUDIO_ARCHIVE,
  formatTime,
  MUSIC_CREDITS,
  NASA_MUSIC,
  recordTracks,
  type RecordTrack,
} from '../../lib/music'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { MusicTrackList } from './MusicTrackList'

export function MusicExperience() {
  const open = useExhibitStore((s) => s.panel === 'music')
  const setPanel = useExhibitStore((s) => s.setPanel)
  const [kind, setKind] = useState<RecordTrack['kind']>('music')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<RecordTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [seekable, setSeekable] = useState(false)
  const [volume, setVolume] = useState(0.75)
  const [error, setError] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const current = useRef<RecordTrack | null>(null)
  const request = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const clearSearch = useCallback(() => setQuery(''), [])

  const start = useCallback(() => {
    const element = audio.current
    if (!element) return
    const generation = ++request.current
    setLoading(true)
    setError(null)
    if (element.error) element.load()
    void element.play().catch((reason: unknown) => {
      if (
        request.current !== generation ||
        (reason instanceof DOMException && reason.name === 'AbortError')
      )
        return
      setLoading(false)
      setPlaying(false)
      setError(
        reason instanceof DOMException && reason.name === 'NotAllowedError'
          ? 'Press play to begin listening.'
          : 'This recording could not load. Retry or open the audio archive below.',
      )
    })
  }, [])

  const choose = useCallback(
    (track: RecordTrack) => {
      const element = audio.current
      if (!element) return
      if (current.current?.id !== track.id) {
        ++request.current
        element.pause()
        current.current = track
        element.src = track.audio
        setSelected(track)
        setPlaying(false)
        setSeekable(false)
        setElapsed(0)
        setDuration(track.duration)
      }
      start()
    },
    [start],
  )

  const toggle = useCallback(() => {
    const element = audio.current
    if (!current.current) choose(recordTracks.find((track) => track.kind === kind)!)
    else if (element?.paused) start()
    else element?.pause()
  }, [choose, start, kind])

  const skip = useCallback(
    (direction: number) => {
      const track = current.current
      if (!track) return
      if (direction < 0 && (audio.current?.currentTime ?? 0) > 3) {
        audio.current!.currentTime = 0
        setElapsed(0)
        return
      }
      const program = recordTracks.filter((entry) => entry.kind === track.kind)
      const next = program[program.findIndex((entry) => entry.id === track.id) + direction]
      if (next) choose(next)
      else if (direction > 0) {
        setPlaying(false)
        setLoading(false)
      }
    },
    [choose],
  )

  const stop = () => {
    ++request.current
    audio.current?.pause()
    audio.current?.removeAttribute('src')
    audio.current?.load()
    current.current = null
    setSelected(null)
    setPlaying(false)
    setLoading(false)
    setSeekable(false)
    setElapsed(0)
    setDuration(0)
    setError(null)
  }

  useEffect(() => {
    if (audio.current) audio.current.volume = volume
  }, [volume])
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if ('MediaMetadata' in window)
      navigator.mediaSession.metadata = selected
        ? new MediaMetadata({
            title: selected.title,
            artist: selected.artist,
            album: 'Voyager Golden Record',
          })
        : null
    const handlers = {
      play: start,
      pause: () => audio.current?.pause(),
      previoustrack: () => skip(-1),
      nexttrack: () => skip(1),
    }
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler)
      } catch {
        /* Some browsers implement only a subset. */
      }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, null)
        } catch {
          /* Optional media integration. */
        }
      }
    }
  }, [selected, start, skip])
  useEffect(() => {
    if ('mediaSession' in navigator)
      navigator.mediaSession.playbackState = selected ? (playing ? 'playing' : 'paused') : 'none'
  }, [selected, playing])
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const seek = (value: number) => {
    if (!audio.current || !Number.isFinite(audio.current.duration)) return
    audio.current.currentTime = value
    setElapsed(value)
  }
  const updateDuration = () => {
    const element = audio.current
    if (!element) return
    if (Number.isFinite(element.duration)) setDuration(element.duration)
    setSeekable(
      element.seekable.length > 0 && element.seekable.end(element.seekable.length - 1) > 0,
    )
  }
  const last = selected?.order === (selected?.kind === 'music' ? 27 : 4)

  return (
    <>
      <audio
        ref={audio}
        preload="none"
        onLoadedMetadata={updateDuration}
        onDurationChange={updateDuration}
        onProgress={updateDuration}
        onTimeUpdate={() => {
          if (audio.current) setElapsed(audio.current.currentTime)
        }}
        onPlaying={() => {
          setPlaying(true)
          setLoading(false)
          setError(null)
        }}
        onPause={() => {
          setPlaying(false)
          setLoading(false)
        }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => {
          setLoading(false)
          updateDuration()
        }}
        onEnded={() => skip(1)}
        onError={() => {
          if (current.current) {
            setPlaying(false)
            setLoading(false)
            setSeekable(false)
            setError('This recording could not load. Retry or open the audio archive below.')
          }
        }}
      />
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!value) setPanel(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="panel-overlay music-overlay" />
          <Dialog.Content
            className="music-window"
            aria-describedby="music-description"
            onOpenAutoFocus={() => {
              returnFocus.current = document.activeElement as HTMLElement
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const element = returnFocus.current
              if (
                element?.isConnected &&
                element.getClientRects().length &&
                getComputedStyle(element).visibility !== 'hidden'
              )
                element.focus()
              else
                document
                  .querySelector<HTMLButtonElement>('.listen-caption, .surface-switch')
                  ?.focus()
            }}
          >
            <header className="music-header">
              <div className="music-heading">
                <Headphones size={20} strokeWidth={1.25} />
                <span>Voyager, 1977</span>
              </div>
              <Dialog.Close className="icon-button music-close" aria-label="Close playlist">
                <X size={19} strokeWidth={1.4} />
              </Dialog.Close>
              <Dialog.Title>The Sounds of Earth</Dialog.Title>
              <Dialog.Description id="music-description">
                A world of music, in the order sent into space.
              </Dialog.Description>
              <div className="music-filters" role="group" aria-label="Audio collection">
                <button
                  aria-pressed={kind === 'music'}
                  onClick={() => {
                    setKind('music')
                    setQuery('')
                  }}
                >
                  Music <span>27</span>
                </button>
                <button
                  aria-pressed={kind === 'voices'}
                  onClick={() => {
                    setKind('voices')
                    setQuery('')
                  }}
                >
                  Greetings & sounds <span>4</span>
                </button>
              </div>
              <label className="music-search">
                <Search size={15} strokeWidth={1.4} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a title, artist or place"
                  aria-label="Search the record"
                />
                {query && (
                  <button aria-label="Clear search" onClick={() => setQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </label>
            </header>
            <MusicTrackList
              kind={kind}
              query={query}
              selectedId={selected?.id}
              playing={playing}
              choose={choose}
              toggle={toggle}
              clearSearch={clearSearch}
            />
            <footer className="music-player">
              <div className="now-playing" aria-live="polite">
                <strong>{selected?.title ?? 'Choose a track'}</strong>
                <span>
                  {selected?.artist ??
                    (kind === 'music'
                      ? '27 musical selections from our shared home.'
                      : 'Four recordings of Earth’s voices and sounds.')}
                </span>
              </div>
              <div className="player-transport">
                <button
                  aria-label="Previous track"
                  onClick={() => skip(-1)}
                  disabled={!selected || (selected.order === 1 && elapsed <= 3)}
                >
                  <SkipBack size={18} strokeWidth={1.4} />
                </button>
                <button
                  className="player-play"
                  aria-label={playing || loading ? 'Pause playback' : 'Play playback'}
                  onClick={toggle}
                >
                  {loading ? (
                    <LoaderCircle className="is-spinning" size={19} />
                  ) : playing ? (
                    <Pause size={19} fill="currentColor" />
                  ) : (
                    <Play size={19} fill="currentColor" />
                  )}
                </button>
                <button
                  aria-label="Next track"
                  onClick={() => skip(1)}
                  disabled={!selected || last}
                >
                  <SkipForward size={18} strokeWidth={1.4} />
                </button>
              </div>
              <div className="player-timeline">
                <span>{formatTime(elapsed)}</span>
                <input
                  aria-label="Seek in track"
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={Math.min(elapsed, duration || 1)}
                  disabled={!selected || !seekable}
                  onChange={(event) => seek(Number(event.target.value))}
                />
                <span>{formatTime(duration)}</span>
              </div>
              <div className="player-meta">
                <span>{loading ? 'Loading recording…' : 'Streamed from Internet Archive'}</span>
                <label>
                  <Volume2 size={14} strokeWidth={1.4} />
                  <input
                    aria-label="Volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                  />
                </label>
              </div>
              {error && (
                <div className="player-error" role="alert">
                  <p>{error}</p>
                  <button onClick={start}>Retry playback</button>
                </div>
              )}
              <div className="music-sources">
                <a href={NASA_MUSIC} target="_blank" rel="noreferrer">
                  NASA catalog <ArrowUpRight size={11} />
                </a>
                <a href={MUSIC_CREDITS} target="_blank" rel="noreferrer">
                  Performer credits <ArrowUpRight size={11} />
                </a>
                <a href={AUDIO_ARCHIVE} target="_blank" rel="noreferrer">
                  Audio archive <ArrowUpRight size={11} />
                </a>
              </div>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {selected && !open && (
        <aside className="mini-player" aria-label="Now playing">
          <button
            className="mini-toggle"
            aria-label={playing || loading ? 'Pause music' : 'Resume music'}
            onClick={toggle}
          >
            {loading ? (
              <LoaderCircle className="is-spinning" size={17} />
            ) : playing ? (
              <Pause size={17} />
            ) : (
              <Play size={17} />
            )}
          </button>
          <button
            className="mini-title"
            onClick={() => setPanel('music')}
            aria-label="Open music playlist"
          >
            <span>
              {error
                ? 'Recording unavailable'
                : playing
                  ? 'Listening to the record'
                  : 'Music paused'}
            </span>
            <strong>{selected.title}</strong>
          </button>
          <button className="mini-stop" onClick={stop} aria-label="Stop listening">
            <X size={15} />
          </button>
        </aside>
      )}
    </>
  )
}
