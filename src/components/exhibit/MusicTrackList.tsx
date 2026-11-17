import { memo, useMemo } from 'react'
import { Pause, Play } from 'lucide-react'
import { filterTracks, formatTime, type RecordTrack } from '../../lib/music'

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
  const tracks = useMemo(() => filterTracks(kind, query), [kind, query])
  return (
    <div className="music-list" role="region" aria-label="Record playlist" tabIndex={0}>
      <ol>
        {tracks.map((track) => {
          const active = selectedId === track.id
          return (
            <li key={track.id}>
              <button
                className={`music-track ${active ? 'is-current' : ''}`}
                aria-label={`${active && playing ? 'Pause' : 'Play'} ${track.title}`}
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
          <p>No tracks found.</p>
          <button onClick={clearSearch}>Clear search</button>
        </div>
      )}
    </div>
  )
})
