# The Golden Record

A minimal 3D gallery: Voyager’s Golden Record and protective cover, on a plain pedestal. White in light mode, black in dark mode. Orbit and zoom the display, explore the eight engraved diagrams, or open the music card on the “Sounds of Earth” face to listen to the complete 27-selection music program.

## Run locally

Requires Node.js 22.12 or later and Corepack.

```sh
corepack enable
yarn install
yarn dev
```

Open http://localhost:3000. `yarn build` produces the static site in `dist/client/`. Serve that directory using any static host, or run `yarn start`.

Development and preview bind to loopback and require an unused port 3000. To expose development to another device deliberately, run `yarn dev --host 0.0.0.0`.

## Stack

React 19, TypeScript, TanStack Start and Router, Vite 8, Tailwind CSS 4, Zustand, Radix Dialog and Tooltip, Three.js, React Three Fiber, and Drei. Visual assets, catalog metadata, and fonts are local; no database or authentication is needed. Audio streams from Internet Archive only after a visitor selects a recording. External audio availability depends on that archive.

## Verify

```sh
yarn typecheck
yarn test
yarn test:e2e
yarn build
yarn format:check
```

The end-to-end suite uses installed Google Chrome and native GPU WebGL. Unit checks cover geometry, malformed geometry assets, coordinates, hover ownership, music order/search, and lightweight picking. Browser checks also cover theme-storage failures and information-dialog focus restoration. Audio interaction tests serve a generated WAV fixture to exercise browser media behavior without relying on the archive.

The [initial-load performance review](docs/PERFORMANCE.md) documents the codebase audit, primary-source research, measured cold-load results, visual checks, and reproduction commands. The build packs the engraving losslessly while keeping the original geometry as a compatibility fallback. No geometry precision, texture resolution, shadow quality, or zoom range is reduced.

## Reference fidelity

The audio record has NASA’s documented 12-inch (304.8 mm) diameter. Its 1.27 mm thickness follows the construction notes in the Sagan papers: two 0.508 mm copper mothers and a 0.254 mm central bond. Each layer is modeled in meters, with a fine bevel instead of the earlier thick rounded rim.

The protective aluminum cover and copper record are separate physical meshes. They are displayed together in a contemporary museum mount, with the engraved cover facing one way and the record’s documented Side 1 label facing the other. The cover is not presented as Side 2 of the phonograph record. Undocumented inner faces remain inside this compact display arrangement.

The cover diagrams are actual recessed mesh cuts, generated from the vector transcription with boolean subtraction, three-facet bevels, and separate recessed floors. Their edges remain geometric at the full 128× zoom. SVG white masking fills restore metal in paint order, preserving the open cartridge bodies, apertures, and overlapping outlines. The modeled 45 µm depth is a visual estimate. A physically scaled procedural finish supplies continuous 6 µm and 18 µm grain fields, subtle 16 µm brushing, and filtered changes in roughness. The shader resolves additional detail as the pixel footprint gets smaller. It replaces the old finite cover grain maps, so close inspection does not enlarge their texels. These are visual material estimates, not microscope measurements of the original. The label and handwritten dedication are recovered as surface reflectance and shallow bump relief from NASA/JPL-Caltech’s photograph; the label relief scale is an 8 µm visual estimate. The black runout ring seen in that photograph is a reflection, rather than black vinyl or an applied black paper label. The grooved face uses a fine procedural spiral, filtered at grazing angles, and a radial anisotropy map to produce moving metal highlights. Studio reflections use a 1024-pixel cubemap; direct shadows use a 4096-pixel map.

The Cover/Record switch below the subtitle changes the displayed face. On desktop, drag to orbit and right-drag to pan. Mobile starts in Drag mode for one-finger panning; choose Orbit in the bottom toolbar to rotate instead. Scroll zoom follows the cursor, and two-finger pinch zoom remains available in either mode. Surface study and lighting controls are available on desktop. Every diagram card and detail panel offers “See it close up” to center an 18× macro view. Zoom reaches 128× with either the wheel/pinch gesture or the controls. The microscope control opens a 96× study of bare cover metal or the record’s grooved annulus with raking light. At close distances, orbit is constrained to the selected face and the near clipping plane adapts to the camera distance. Reset restores the pedestal view. Cards are placed outside the projected bounds of their subject and neighboring figures, with preference for nearby space just outside the circular artifact. A small placement tolerance prevents jitter while allowing a distant card to move closer when space becomes available. A fine connector and a pointer-safe corridor keep separated cards reachable. If the subject fills the view, a separate side or bottom reading rail reserves space outside the renderer. Dismissal restores the inspection viewport without resetting the viewed point or zoom. Above 32×, information opens through the markers rather than appearing across the material surface.

Surface activation follows the actual recessed walls and floors with a 2 CSS-pixel allowance, measured after projection so it stays consistent as the camera or zoom changes. Uncut interiors and spaces between rays stay inactive. Circular information markers sit beside or above each engraving and fade in after the first drag, orbit, or zoom. They stay visible through resets and face changes until the page reloads. Before that first interaction, markers ignore the pointer while retaining keyboard access. The card approach corridor begins at the actual hit point and accommodates diagonal movement. Moving across blank metal dismisses the card after its short leave grace period.

Hover or select the headphone marker on the record label to open the playlist. The record’s “Listen” caption provides the same action without relying on 3D. Search by title, performer or place; choose from 27 musical selections or four greeting/sound segments. Closing the window keeps playback available in a compact player while inspecting the artifact. Tracks advance within the selected program. Native Media Session controls are supported where the browser exposes them.

The music order follows NASA’s inventory, with performer names from Ozma’s reissue documentation. Streams use the linked Internet Archive digitization; its track lengths can differ from NASA’s listed timings. Music is not rehosted or included in the deployment archive.

This is a reference-based reconstruction, not a 3D scan. Cover diameter and thickness, small bevels, engraving depth, groove pitch, and display spacing remain photographic or visual estimates. The eight cover figures use a public-domain vector transcription checked against NASA’s photograph. The display is not calibrated to physical size on the user’s screen, and the rendered grooves do not encode playable audio. These limits appear in the About panel.

## Assets and credits

- [NASA: Golden Record cover](https://science.nasa.gov/mission/voyager/golden-record-cover/) — diagrams and decoding instructions.
- [NASA: Making of the Golden Record](https://science.nasa.gov/mission/voyager/making-of-the-golden-record/) — diameter and materials.
- [NASA: Golden Record overview](https://science.nasa.gov/mission/voyager/voyager-golden-record-overview/) — historical context.
- [Sagan papers, Library of Congress](https://tile.loc.gov/storage-services/service/mss/mss85590/038/038.pdf) — original 0.050-inch bonded copper construction.
- [Nicolás González Montofré: Voyager plaque.svg](https://commons.wikimedia.org/wiki/File:Voyager_plaque.svg) — public-domain vector transcription, modified to remove the flat silhouette and produce separate material maps and diagram crops.
- Reference photographs and derived record textures: Courtesy NASA/JPL-Caltech, supplied in `public/assets/`. Follow the [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/), retain attribution, and do not imply endorsement. Any rights indicated by an individual source caption remain applicable.
- [NASA: Sounds and music inventory](https://science.nasa.gov/mission/voyager/golden-record-contents/sounds/) and [Ozma: performer credits](https://ozmarecords.com/pages/voyager) — music catalog and sequence.
- [Internet Archive: The Golden Voyager Record](https://archive.org/details/the-golden-voyager-record) — externally streamed audio digitization. Recording rights remain with their respective owners.
- Fonts: Instrument Serif and DM Sans, distributed through Fontsource under the SIL Open Font License 1.1. Their copyright and license texts are included in [Instrument Serif OFL](public/licenses/instrument-serif-OFL.txt) and [DM Sans OFL](public/licenses/dm-sans-OFL.txt).

Run `yarn assets` to regenerate the deterministic material maps and diagram crops from the included references. This independent educational exhibit is not affiliated with or endorsed by NASA.

## License and contributions

Original project code is available under the [MIT License](LICENSE). It allows reuse, modification, redistribution, and commercial use while requiring preservation of the copyright and permission notice. It does not require downstream projects to publish their source.

Third-party imagery, artwork, fonts, dependencies, and externally streamed recordings retain their own terms and the credits above. Dependencies retain their individual licenses; exact resolved versions are recorded in `yarn.lock`. The repository license does not grant recording rights. Keep the applicable copyright and license notices when redistributing this exhibit or its dependencies.

Use `yarn format` before submitting changes, and run the verification commands above. The generated route tree and artwork assets are excluded from formatting; regenerate those through their owning tools.
