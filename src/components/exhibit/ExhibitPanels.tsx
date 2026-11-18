import * as Dialog from '@radix-ui/react-dialog'
import { useRef } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from 'lucide-react'
import { inscriptions, NASA_COVER, NASA_MAKING, NASA_OVERVIEW } from '../../lib/inscriptions'
import { SOURCE_URL } from '../../lib/seo'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { DiagramPreview } from './DiagramPreview'
import { useI18n } from '../../lib/i18n'

export function ExhibitPanels() {
  const { t, number } = useI18n()
  const panel = useExhibitStore((s) => s.panel)
  const selected = useExhibitStore((s) => s.selected)
  const setPanel = useExhibitStore((s) => s.setPanel)
  const setSelected = useExhibitStore((s) => s.setSelected)
  const index = inscriptions.findIndex((item) => item.id === selected)
  const source = inscriptions[index]
  const item = source ? { ...source, ...t.inscriptions[source.id] } : undefined
  const returnFocus = useRef<HTMLElement | null>(null)
  const close = () => {
    setSelected(null)
    setPanel(null)
  }
  return (
    <Dialog.Root
      open={panel === 'sources' || Boolean(selected)}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="panel-overlay" />
        <Dialog.Content
          className={`gallery-panel ${item ? 'engraving-detail' : ''}`}
          aria-describedby="panel-description"
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const opener = returnFocus.current
            if (
              opener?.isConnected &&
              opener.getClientRects().length &&
              getComputedStyle(opener).visibility !== 'hidden'
            )
              opener.focus()
            else document.getElementById('viewer-controls')?.focus()
          }}
        >
          <Dialog.Close className="panel-close icon-button" aria-label={t.details.close}>
            <X size={20} strokeWidth={1.4} />
          </Dialog.Close>
          <Dialog.Title>{item ? item.title : t.exhibit.about}</Dialog.Title>
          <Dialog.Description id="panel-description">
            {item ? item.summary : t.about.summary}
          </Dialog.Description>
          {item ? (
            <div className="detail-content">
              <DiagramPreview item={item} />
              <span className="detail-category">{item.category}</span>
              <p>{item.explanation}</p>
              <div className="detail-fact">
                <strong>{item.fact}</strong>
                <span>{item.unit}</span>
              </div>
              <a
                className="source-link"
                href={NASA_COVER}
                target="_blank"
                rel="noopener noreferrer"
                hrefLang="en"
              >
                {t.details.source} <ArrowUpRight size={13} />
              </a>
              <div className="detail-pagination">
                <button
                  aria-label={t.details.previous}
                  onClick={() =>
                    setSelected(
                      inscriptions[(index + inscriptions.length - 1) % inscriptions.length].id,
                    )
                  }
                >
                  <ArrowLeft size={18} />
                </button>
                <span>
                  {number(index + 1)} / {number(inscriptions.length)}
                </span>
                <button
                  aria-label={t.details.next}
                  onClick={() => setSelected(inscriptions[(index + 1) % inscriptions.length].id)}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="about-content">
              <p>{t.about.materials}</p>
              <dl>
                <div>
                  <dt>{t.about.diameter}</dt>
                  <dd>{number(304.8)} mm</dd>
                </div>
                <div>
                  <dt>{t.about.thickness}</dt>
                  <dd>{number(1.27)} mm</dd>
                </div>
                <div>
                  <dt>{t.about.construction}</dt>
                  <dd>
                    {t.about.faces(`${number(0.508)} mm`)}
                    <br />
                    {t.about.bond(`${number(0.254)} mm`)}
                  </dd>
                </div>
              </dl>
              <p>{t.about.instructions}</p>
              <p className="reference-note">{t.about.reference}</p>
              <div className="reference-links">
                <a href={NASA_OVERVIEW} target="_blank" rel="noopener noreferrer" hrefLang="en">
                  {t.about.overview} <ArrowUpRight size={13} />
                </a>
                <a href={NASA_MAKING} target="_blank" rel="noopener noreferrer">
                  {t.about.manufacture} <ArrowUpRight size={13} />
                </a>
                <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" hrefLang="en">
                  {t.about.code} <ArrowUpRight size={13} />
                </a>
                <a href={NASA_COVER} target="_blank" rel="noopener noreferrer">
                  {t.about.diagrams} <ArrowUpRight size={13} />
                </a>
                <a
                  href="https://tile.loc.gov/storage-services/service/mss/mss85590/038/038.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.about.notes} <ArrowUpRight size={13} />
                </a>
                <a
                  href="https://commons.wikimedia.org/wiki/File:Voyager_plaque.svg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t.about.transcription} <ArrowUpRight size={13} />
                </a>
              </div>
              <p className="credit-note">{t.about.credits}</p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
