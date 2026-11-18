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
  filterTracks,
  formatTime,
  localizeTrack,
  MUSIC_CREDITS,
  NASA_MUSIC,
  recordTracks,
  type RecordTrack,
} from '../../lib/music'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { MusicTrackList } from './MusicTrackList'
import { useI18n } from '../../lib/i18n'
import {
  beginOperation,
  reportFailure,
  trackInteraction,
  type ObservationAttributes,
} from '../../lib/observability'

const trackAttributes = (track: RecordTrack | null): ObservationAttributes =>
  track ? { track_id: track.id, program: track.kind } : {}

export function MusicExperience() {
  const { t, locale, number } = useI18n()
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
  const [error, setError] = useState<'blocked' | 'failed' | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const current = useRef<RecordTrack | null>(null)
  const request = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const startup = useRef<ReturnType<typeof beginOperation> | undefined>(undefined)
  const buffering = useRef<ReturnType<typeof beginOperation> | undefined>(undefined)
  const reportedFailure = useRef<number | null>(null)
  const playbackActive = useRef(false)
  const seekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const volumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const clearSearch = useCallback(() => setQuery(''), [])

  const playbackFailed = useCallback((reason: unknown, code: string) => {
    if (reportedFailure.current === request.current) return
    reportedFailure.current = request.current
    startup.current?.('error')
    startup.current = undefined
    buffering.current?.('error')
    buffering.current = undefined
    reportFailure(reason, 'audio', { ...trackAttributes(current.current), code })
  }, [])

  const start = useCallback(() => {
    const element = audio.current
    if (!element) return
    const generation = ++request.current
    reportedFailure.current = null
    startup.current?.('cancelled')
    startup.current = beginOperation('audio.startup', trackAttributes(current.current))
    trackInteraction('audio.play_requested', trackAttributes(current.current))
    setLoading(true)
    setError(null)
    if (element.error) element.load()
    void element.play().catch((reason: unknown) => {
      if (request.current !== generation) return
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        startup.current?.('cancelled')
        startup.current = undefined
        return
      }
      if (reason instanceof DOMException && reason.name === 'NotAllowedError') {
        startup.current?.('cancelled')
        startup.current = undefined
        trackInteraction('audio.play_blocked', trackAttributes(current.current))
      } else playbackFailed(reason, reason instanceof Error ? reason.name : 'play_rejected')
      setLoading(false)
      setPlaying(false)
      setError(
        reason instanceof DOMException && reason.name === 'NotAllowedError' ? 'blocked' : 'failed',
      )
    })
  }, [playbackFailed])

  const choose = useCallback(
    (track: RecordTrack) => {
      const element = audio.current
      if (!element) return
      if (current.current?.id !== track.id) {
        startup.current?.('cancelled')
        buffering.current?.('cancelled')
        buffering.current = undefined
        playbackActive.current = false
        trackInteraction('audio.track_selected', trackAttributes(track))
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
      trackInteraction('audio.skipped', { ...trackAttributes(track), direction })
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
    trackInteraction('audio.stopped', trackAttributes(current.current))
    startup.current?.('cancelled')
    startup.current = undefined
    buffering.current?.('cancelled')
    buffering.current = undefined
    playbackActive.current = false
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
  const selectedCopy = selected ? localizeTrack(selected, locale) : null
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if ('MediaMetadata' in window)
      navigator.mediaSession.metadata = selectedCopy
        ? new MediaMetadata({
            title: selectedCopy.title,
            artist: selectedCopy.artist,
            album: t.music.album,
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
  }, [selectedCopy, start, skip, t])
  useEffect(() => {
    if ('mediaSession' in navigator)
      navigator.mediaSession.playbackState = selected ? (playing ? 'playing' : 'paused') : 'none'
  }, [selected, playing])
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])
  useEffect(() => {
    if (!open || !query.trim()) return
    const timer = setTimeout(
      () =>
        trackInteraction('audio.searched', {
          program: kind,
          results: filterTracks(kind, query, locale).length,
        }),
      600,
    )
    return () => clearTimeout(timer)
  }, [kind, open, query, locale])
  useEffect(
    () => () => {
      startup.current?.('cancelled')
      buffering.current?.('cancelled')
      clearTimeout(seekTimer.current)
      clearTimeout(volumeTimer.current)
    },
    [],
  )

  const seek = (value: number) => {
    if (!audio.current || !Number.isFinite(audio.current.duration)) return
    audio.current.currentTime = value
    setElapsed(value)
    clearTimeout(seekTimer.current)
    const attributes = { ...trackAttributes(current.current), position_seconds: Math.round(value) }
    seekTimer.current = setTimeout(() => trackInteraction('audio.seeked', attributes), 300)
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
          startup.current?.('ok')
          startup.current = undefined
          buffering.current?.('ok')
          buffering.current = undefined
          if (!playbackActive.current)
            trackInteraction('audio.playing', trackAttributes(current.current))
          playbackActive.current = true
          setPlaying(true)
          setLoading(false)
          setError(null)
        }}
        onPause={() => {
          if (playbackActive.current)
            trackInteraction('audio.paused', trackAttributes(current.current))
          playbackActive.current = false
          buffering.current?.('cancelled')
          buffering.current = undefined
          setPlaying(false)
          setLoading(false)
        }}
        onWaiting={() => {
          if (playbackActive.current && !buffering.current) {
            buffering.current = beginOperation('audio.buffering', trackAttributes(current.current))
            trackInteraction('audio.buffering', trackAttributes(current.current))
          }
          setLoading(true)
        }}
        onCanPlay={() => {
          setLoading(false)
          updateDuration()
        }}
        onEnded={() => {
          trackInteraction('audio.ended', trackAttributes(current.current))
          skip(1)
        }}
        onError={() => {
          if (current.current) {
            playbackFailed(
              new Error('Audio recording could not load'),
              `media_${audio.current?.error?.code ?? 'unknown'}`,
            )
            playbackActive.current = false
            setPlaying(false)
            setLoading(false)
            setSeekable(false)
            setError('failed')
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
              <Dialog.Close className="icon-button music-close" aria-label={t.music.close}>
                <X size={19} strokeWidth={1.4} />
              </Dialog.Close>
              <Dialog.Title>{t.music.title}</Dialog.Title>
              <Dialog.Description id="music-description">{t.music.summary}</Dialog.Description>
              <div className="music-filters" role="group" aria-label={t.music.collection}>
                <button
                  aria-pressed={kind === 'music'}
                  onClick={() => {
                    trackInteraction('audio.collection_changed', { program: 'music' })
                    setKind('music')
                    setQuery('')
                  }}
                >
                  {t.music.music} <span>27</span>
                </button>
                <button
                  aria-pressed={kind === 'voices'}
                  onClick={() => {
                    trackInteraction('audio.collection_changed', { program: 'voices' })
                    setKind('voices')
                    setQuery('')
                  }}
                >
                  {t.music.voices} <span>4</span>
                </button>
              </div>
              <label className="music-search">
                <Search size={15} strokeWidth={1.4} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.music.searchPlaceholder}
                  aria-label={t.music.search}
                />
                {query && (
                  <button aria-label={t.music.clear} onClick={() => setQuery('')}>
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
                <strong>{selectedCopy?.title ?? t.music.choose}</strong>
                <span>
                  {selectedCopy?.artist ??
                    (kind === 'music' ? t.music.musicSummary : t.music.voicesSummary)}
                </span>
              </div>
              <div className="player-transport">
                <button
                  aria-label={t.music.previous}
                  onClick={() => skip(-1)}
                  disabled={!selected || (selected.order === 1 && elapsed <= 3)}
                >
                  <SkipBack size={18} strokeWidth={1.4} />
                </button>
                <button
                  className="player-play"
                  aria-label={playing || loading ? t.music.pause : t.music.play}
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
                  aria-label={t.music.next}
                  onClick={() => skip(1)}
                  disabled={!selected || last}
                >
                  <SkipForward size={18} strokeWidth={1.4} />
                </button>
              </div>
              <div className="player-timeline">
                <span>{formatTime(elapsed)}</span>
                <input
                  aria-label={t.music.seek}
                  aria-valuetext={`${formatTime(elapsed)} / ${formatTime(duration)}`}
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
                <span>{loading ? t.music.loading : t.music.streamed}</span>
                <label>
                  <Volume2 size={14} strokeWidth={1.4} />
                  <input
                    aria-label={t.music.volume}
                    aria-valuetext={number(volume, { style: 'percent', maximumFractionDigits: 0 })}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => {
                      const value = Number(event.target.value)
                      setVolume(value)
                      clearTimeout(volumeTimer.current)
                      volumeTimer.current = setTimeout(
                        () => trackInteraction('audio.volume_changed', { volume: value }),
                        300,
                      )
                    }}
                  />
                </label>
              </div>
              {error && (
                <div className="player-error" role="alert">
                  <p>{t.music[error]}</p>
                  <button
                    onClick={() => {
                      trackInteraction('audio.retried', trackAttributes(current.current))
                      start()
                    }}
                  >
                    {t.music.retry}
                  </button>
                </div>
              )}
              <div className="music-sources">
                <a href={NASA_MUSIC} target="_blank" rel="noreferrer">
                  {t.music.catalog} <ArrowUpRight size={11} />
                </a>
                <a href={MUSIC_CREDITS} target="_blank" rel="noreferrer">
                  {t.music.credits} <ArrowUpRight size={11} />
                </a>
                <a href={AUDIO_ARCHIVE} target="_blank" rel="noreferrer">
                  {t.music.archive} <ArrowUpRight size={11} />
                </a>
              </div>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {selected && !open && (
        <aside className="mini-player" aria-label={t.music.nowPlaying}>
          <button
            className="mini-toggle"
            aria-label={playing || loading ? t.music.pauseMusic : t.music.resume}
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
            aria-label={t.music.open}
          >
            <span>
              {error ? t.music.unavailable : playing ? t.music.listening : t.music.paused}
            </span>
            <strong>{selectedCopy?.title}</strong>
          </button>
          <button className="mini-stop" onClick={stop} aria-label={t.music.stop}>
            <X size={15} />
          </button>
        </aside>
      )}
    </>
  )
}
