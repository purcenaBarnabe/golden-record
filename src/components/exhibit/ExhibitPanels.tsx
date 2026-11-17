import * as Dialog from '@radix-ui/react-dialog'
import { useRef } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Focus, X } from 'lucide-react'
import { inscriptions, NASA_COVER, NASA_MAKING } from '../../lib/inscriptions'
import { useExhibitStore } from '../../stores/use-exhibit-store'
import { DiagramPreview } from './DiagramPreview'

export function ExhibitPanels() {
  const panel = useExhibitStore((s) => s.panel)
  const selected = useExhibitStore((s) => s.selected)
  const setPanel = useExhibitStore((s) => s.setPanel)
  const setSelected = useExhibitStore((s) => s.setSelected)
  const inspectEngraving = useExhibitStore((s) => s.inspectEngraving)
  const index = inscriptions.findIndex((item) => item.id === selected)
  const item = inscriptions[index]
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
          <Dialog.Close className="panel-close icon-button" aria-label="Close information">
            <X size={20} strokeWidth={1.4} />
          </Dialog.Close>
          <Dialog.Title>{item ? item.title : 'About this recreation'}</Dialog.Title>
          <Dialog.Description id="panel-description">
            {item
              ? item.summary
              : 'A message from Earth, carried by both Voyager spacecraft since 1977.'}
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
              <a className="source-link" href={NASA_COVER} target="_blank" rel="noreferrer">
                NASA’s explanation <ArrowUpRight size={13} />
              </a>
              <button className="inspect-carving" onClick={() => inspectEngraving(item.id)}>
                <Focus size={15} /> See it close up <ArrowUpRight size={13} />
              </button>
              <div className="detail-pagination">
                <button
                  aria-label="Previous engraving"
                  onClick={() =>
                    setSelected(
                      inscriptions[(index + inscriptions.length - 1) % inscriptions.length].id,
                    )
                  }
                >
                  <ArrowLeft size={18} />
                </button>
                <span>
                  {index + 1} / {inscriptions.length}
                </span>
                <button
                  aria-label="Next engraving"
                  onClick={() => setSelected(inscriptions[(index + 1) % inscriptions.length].id)}
                >
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          ) : (
            <div className="about-content">
              <p>
                The 12-inch record is gold-plated copper. The diagrams belong to its separate
                aluminum protective cover. Both parts are shown together in a contemporary museum
                mount: the engraved cover on one side, the record’s documented Side 1 label on the
                other.
              </p>
              <dl>
                <div>
                  <dt>Record diameter</dt>
                  <dd>304.8 mm</dd>
                </div>
                <div>
                  <dt>Record thickness</dt>
                  <dd>1.27 mm</dd>
                </div>
                <div>
                  <dt>Construction</dt>
                  <dd>
                    Two 0.508 mm copper faces
                    <br />
                    with a 0.254 mm bond
                  </dd>
                </div>
              </dl>
              <p>
                Drag to orbit on desktop; right-drag to pan. On mobile, Drag moves the display with
                one finger, and Orbit rotates it. Switch modes below the title. Scroll toward the
                pointer or pinch to zoom up to 128×. The desktop microscope control opens a 96×
                surface study under raking light. Choose “See it close up” for a diagram close-up.
                At deep zoom, use a marker to open its information card; orbit stays on the chosen
                face. Reset view returns to the pedestal.
              </p>
              <p className="reference-note">
                Record thickness follows the original construction notes in the Sagan papers. Cover
                dimensions, small edge bevels, engraving depth, and display spacing remain estimates
                from photographs. Microscopic grain, brushing, and groove shape are material
                reconstructions, not measurements of a flight article. The cover artwork is a vector
                transcription; the label derives from NASA’s photograph. This is an independent
                reconstruction, not a 3D scan.
              </p>
              <div className="reference-links">
                <a href={NASA_MAKING} target="_blank" rel="noreferrer">
                  NASA · Materials and manufacture <ArrowUpRight size={13} />
                </a>
                <a href={NASA_COVER} target="_blank" rel="noreferrer">
                  NASA · Cover diagrams <ArrowUpRight size={13} />
                </a>
                <a
                  href="https://tile.loc.gov/storage-services/service/mss/mss85590/038/038.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  Library of Congress · Construction notes <ArrowUpRight size={13} />
                </a>
                <a
                  href="https://commons.wikimedia.org/wiki/File:Voyager_plaque.svg"
                  target="_blank"
                  rel="noreferrer"
                >
                  Nicolás González Montofré · Diagram transcription <ArrowUpRight size={13} />
                </a>
              </div>
              <p className="credit-note">
                Reference photography: NASA/JPL-Caltech. Diagram transcription: Nicolás González
                Montofré, public domain. Not affiliated with NASA.
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
