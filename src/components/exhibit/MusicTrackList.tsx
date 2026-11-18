import { memo, useMemo } from 'react'
import { Pause, Play } from 'lucide-react'
import { filterTracks, formatTime, type RecordTrack } from '../../lib/music'
import { useI18n } from '../../lib/i18n'

export const MusicTrackList = memo(function MusicTrackList({
  kind,
  query,
  selectedId,
  playing,
  choose,
  toggle,
  clearSearch,
}: {
  kind: RecordTrack['kind']
  query: string
  selectedId: number | undefined
  playing: boolean
  choose: (track: RecordTrack) => void
  toggle: () => void
  clearSearch: () => void
}) {
  const { t, locale } = useI18n()
  const tracks = useMemo(() => filterTracks(kind, query, locale), [kind, query, locale])
  return (
    <div className="music-list" role="region" aria-label={t.music.playlist} tabIndex={0}>
      <ol>
        {tracks.map((track) => {
          const active = selectedId === track.id
          return (
            <li key={track.id}>
              <button
                className={`music-track ${active ? 'is-current' : ''}`}
                aria-label={
                  active && playing
                    ? t.music.pauseTrack(track.title)
                    : t.music.playTrack(track.title)
                }
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  if (active) toggle()
                  else choose(track)
                }}
              >
                <span className="track-number" aria-hidden="true">
                  {active && playing ? (
                    <span className="playing-bars">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    String(track.order).padStart(2, '0')
                  )}
                </span>
                <span className="track-copy">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                  <small>{track.place}</small>
                </span>
                <span className="track-duration">{formatTime(track.duration)}</span>
                <span className="track-action" aria-hidden="true">
                  {active && playing ? <Pause size={14} /> : <Play size={14} />}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {!tracks.length && (
        <div className="music-empty">
          <p>{t.music.empty}</p>
          <button onClick={clearSearch}>{t.music.clear}</button>
        </div>
      )}
    </div>
  )
})
