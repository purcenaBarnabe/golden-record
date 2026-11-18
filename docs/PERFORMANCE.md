# Initial-load performance review

18 November 2026. Baseline: `fb975e3e05fb24f130fcffe72c7bd00fe391a37c`.

The main startup cost was transferring the cover's 9,732,776-byte engraving asset, followed by scene preparation. The final implementation keeps the exact geometry and full rendering settings, transfers a lossless 2,674,800-byte package, and avoids waiting for separate code and asset Suspense reveals. The information badges now use 18% white, increasing to 32% on hover or keyboard focus.

## Measured results

Seven alternating baseline/candidate pairs per profile, using fresh Chrome processes and cold HTTP caches:

| Complete 3D readiness | Baseline median (range) | Optimized median (range) | Reduction |
| --------------------- | ----------------------- | ------------------------ | --------: |
| Desktop               | 1.060s (1.044–1.063)    | 0.568s (0.562–0.586)     |     46.4% |
| Mobile emulation      | 10.703s (10.648–10.747) | 4.987s (4.954–4.996)     |     53.4% |

Initial transfer fell from **10.88 to 4.14 MiB** on desktop and **10.86 to 4.12 MiB** on mobile, about **62% less**. The geometry package alone is 72.5% smaller than the original binary. All **36 artifact image pairs were pixel-identical**, including the full 128× studies.

The no-WebGL photograph path was measured separately, with three alternating pairs per profile. Desktop median improved from 0.464s to 0.165s; mobile from 1.989s to 1.939s. Neither variant requested geometry or record maps in this path.

The readiness milestone is the later of enabled controls and a GPU fence completing after the first full main-framebuffer scene frame. Photo mode waits for decoded image data and an animation frame. It does not time only the loading label. Both variants use identical instrumentation, hardware rendering, reduced motion, disabled HTTP caches, and blocked service workers. Each pair reverses variant order; no other test/browser GPU workload ran during the final trials.

Desktop uses 1440×1000, DPR 1, no throttling. Mobile uses 390×844, DPR 2, 4× CPU throttling, 40ms latency, and 1,250,000 bytes/s download (10Mbps). Host: Apple M4 Pro, macOS Darwin 25.6.0, Node 22.17.1; Chrome 157.0.8103.79 using ANGLE Metal on the M4 Pro. These are controlled local production-build measurements, not real Android hardware or post-deployment real-user measurements. The candidate isolates this performance work on the marker/control revision `b83324d`; the concurrent observability integration is excluded.

Compression and preparation have a CPU tradeoff: median summed startup long tasks changed from 230ms to 359ms on desktop, and 1074ms to 1081ms on mobile. The demonstrated gain is faster complete readiness and lower transfer; no universal CPU/GPU or steady-state FPS improvement is claimed.

Raw evidence: [cold-load samples and resource timings](performance/cold-load.json), [photograph fallback samples](performance/fallback.json), [36 image-comparison results](performance/render-quality.json), and [summary with exact package/browser versions](performance/summary.json). Installed versions: Three 0.183.2, R3F 9.8.2, Drei 10.7.9, React 19.3.1, Meshoptimizer 1.0.1, and three-mesh-bvh 0.8.3.

## What changed

### Lossless engraving delivery

[`scripts/pack-cover.mjs`](../scripts/pack-cover.mjs) encodes the existing indexed V2 reference with pinned Meshoptimizer 1.0.1 and gzip. It does not regenerate, simplify, quantize, filter, or reorder the mesh. Attribute streams retain their original bytes; the index-sequence codec preserves the complete index order. UVs are omitted only when every component is proven to reconstruct to the exact original Float32 value. The unit test compares the entire decoded buffer against the original binary, including UVs, normals, and indices. This follows Meshoptimizer's distinction between lossless attribute encoding and optional quantization/filtering. [Meshoptimizer JavaScript documentation](https://github.com/zeux/meshoptimizer/blob/v1.0.1/js/README.md).

[`cover-package.ts`](../src/lib/cover-package.ts) bounds decoded allocation, validates the format and stream lengths, and restores the original raw buffer. [`cover-loader.ts`](../src/lib/cover-loader.ts) then uses the existing strict geometry parser. Equivalent indexed validation loops replace per-element callbacks; all attribute, index, layout, and geometry-bound checks remain.

The `.pack.bin` suffix deliberately avoids static hosts' special treatment of `.gz` paths. The package has its own gzip envelope, decoded with native `DecompressionStream`; it also accepts a response already decompressed by a host. Neither success depends on the host compressing octet-stream responses. The published original asset was observed without `Content-Encoding`, even when Brotli/gzip were accepted. [Native gzip streams](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream), [Cloudflare compression content types](https://developers.cloudflare.com/speed/optimization/content/compression/).

If native gzip or the WASM decoder is unavailable, the loader goes directly to the original asset without downloading the optimized package. A failed or corrupt optimized response also falls back to that original asset. The build creates both assets, and engraving regeneration updates the package automatically. [`cover-loading.json`](../public/assets/cover-loading.json) records sizes and SHA-256 hashes.

### Start work earlier without slowing the photograph fallback

[`ArtifactViewer`](../src/components/exhibit/ArtifactViewer.tsx) starts the existing scene import during client initialization and mounts the resolved component through state. The scene remains split from the initial UI and is never initialized during prerendering. This preserves the loading screen while avoiding a measured code-boundary reveal delay.

After Canvas successfully creates WebGL, [`prepareExhibitAssets`](../src/lib/preload-exhibit.ts) fills the existing public R3F loader caches for the geometry and all four record maps. A shared loading manager includes geometry decompression and validation, rather than considering the resource ready at network completion. `PreparedScene` mounts the models once those caches are fulfilled. Both faces are available when the exhibit becomes ready; choosing Record does not initiate a second texture-loading phase. R3F documents shared loader caches and preloading. [Loader APIs](https://r3f.docs.pmnd.rs/api/hooks), [scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance).

No geometry or record maps are requested if WebGL creation fails. Photograph, information, face switching, and music remain available. The original scene error boundary and context-loss guard remain in place; loading effects ignore completion after unmount. The spinner still waits for the real scene's readiness callback, rather than disappearing earlier to improve the metric.

### Preserve lighting while trimming general loader code

[`StudioEnvironment`](../src/components/scene/StudioEnvironment.tsx) uses Three's native cube camera and the same seven Drei Lightformers for one static capture. The 1024px half-float target, light positions/intensities, clip planes, and scene environment assignment match the original. This avoids importing general HDR, EXR, gain-map, and ground-environment support for a procedural studio. The render target is disposed on unmount. [Three CubeCamera](https://threejs.org/docs/pages/CubeCamera.html), [Drei environments](https://drei.docs.pmnd.rs/staging/environment).

PCSS setup mounts before the prepared model graph, using the same `SoftShadows` parameters. This avoids installing the global shadow shader after the models become available. Installed Drei's effect invalidates programs and calls `gl.compile`, so its ordering matters. No shader-sample or shadow-resolution reductions were made.

Tailwind's source detection is explicitly limited to `src/`. An isolated rebuild exposed unrelated utility classes entering its automatic scan; the explicit base keeps dependency files, reports, and generated artifacts from enlarging the stylesheet. All application components remain in the scan. [Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).

## Whole-codebase review

The review covered all application source areas, asset generators, configuration, headers, and existing tests. Changes were concentrated on the measured startup path.

| Area                               | Finding and disposition                                                                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing, prerendering, local fonts | The single prerendered route and local fonts already avoid server and external-font dependencies. Retained them; improved scene discovery and mounting.                                                               |
| Gallery, dialogs, themes, controls | Small UI; closed Radix portals do not download their diagram images. Kept system-theme tracking, stored overrides, keyboard access, mobile Drag/Orbit and pinch behavior.                                             |
| Geometry, materials, picking       | Raw geometry dominated transfer. Packed it losslessly; preserved the procedural metal shaders, dimensions, beveled cuts, index order, bounds, and cached indirect BVH picking.                                        |
| GPU setup, lights, shadows         | Already demand rendered with finite environment/contact captures. Kept that behavior; reduced unused environment-loader code and changed PCSS setup ordering.                                                         |
| Annotations and callout placement  | Projection and layout allocation can matter while an open card follows a moving camera. They are not the initial-load bottleneck; retained clipping, cut-only picking, hover corridors, and reading-rail restoration. |
| Zustand and hooks                  | Narrow selectors, shallow equality, and repeated-value guards already limit React work. No broad store or frame-loop rewrite was warranted.                                                                           |
| Music and media                    | Audio already has no source until selection and uses `preload="none"`. Kept playback, media controls, queue, search, and the persistent compact player intact.                                                        |
| Asset/build pipeline and policy    | Added a deterministic build-time packer and a local pinned decoder. CSP permits only the additional `wasm-unsafe-eval` capability; no generic `unsafe-eval` or external decoder/CDN was added.                        |
| Verification tooling               | Added repeated production cold-load measurement, full-buffer equality/corruption tests, actual-CSP and decoder-failure browser checks, and controlled artifact image comparisons.                                     |

Demand rendering, resource reuse, frame-local mutations, and restrained store subscriptions were already sound. They were retained according to R3F's performance guidance. [Performance pitfalls](https://r3f.docs.pmnd.rs/advanced/pitfalls). The WASM CSP capability is distinct from unrestricted JavaScript evaluation. [MDN script-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

## Experiments rejected or deferred

- **Serialized picking BVHs:** measured mobile readiness around 5.29s versus 4.65s without the trees in the same earlier prototype. Their extra 0.91 MiB cost more transfer time than the roughly 140ms of CPU work saved. Runtime BVHs remain cached and index-preserving.
- **Unconditional HTML/module asset preloads:** helped the 3D prototype, but slowed the no-WebGL photograph from about 1.99s to 4.16s. Removed them; requests now depend on successful Canvas creation.
- **Async renderer gate:** researched the supported async `gl` factory and verified ownership/disposal in installed R3F. It retained a reveal delay and measured about 1.09s desktop. The simpler synchronous renderer plus explicit prepared-scene state measured better. [Canvas renderer and ownership API](https://r3f.docs.pmnd.rs/api/canvas).
- **An assumed duplicate environment capture:** rejected after reading installed Drei. Its `frames={2}` counter starts at one, so the original performed one capture, not two. The lean wrapper's benefit is less general loader code; no two-to-one capture saving is claimed.
- **Duplicate texture warm-up:** not added because installed Drei `useTexture` already calls `gl.initTexture`. [Texture helper](https://drei.docs.pmnd.rs/loaders/texture-use-texture).
- **`compileAsync`, worker decoding, and baked shadows:** researched as possible follow-ups. They need separate traces and lifecycle/quality proof; no unmeasured speedup is claimed. Three exposes async compilation, and Meshoptimizer provides worker decoding. [Renderer APIs](https://threejs.org/docs/pages/WebGLRenderer.html), [Meshoptimizer worker APIs](https://github.com/zeux/meshoptimizer/blob/v1.0.1/js/README.md).
- **Reduced visual settings or delayed reverse-face textures:** excluded. No lower DPR, fewer triangles, quantized positions/normals, smaller maps, weaker anisotropy, reduced shadows, or first-switch texture delay was used.
- **Immutable asset caching or lazy music UI:** not needed to explain a cold-load improvement. Existing URLs are unversioned, and the music UI is small and shares dialog dependencies. No speculative rewrite was applied.

## Quality boundaries and verification

The cover retains 224,694 vertices and 211,878 triangles, original Float32 precision and triangle order, three-facet bevels, estimated 45µm recess depth, and the same procedural microfinish. Record maps remain at 4096²/2048² with anisotropy 16. DPR remains `[1, 2]`; environment, directional-shadow, and contact-shadow resolutions remain 1024, 4096, and 2048. PCSS remains size 12, 24 samples, focus 0.4. Macro inspection, 96× surface studies, and the full 128× maximum remain available.

The image check compares the rendered canvas only, excluding intentionally changed HTML controls/badges. It covers desktop and mobile, both themes, studio/raking light on both faces, an 18× engraving, and 96×/128× material studies: 36 before/after pairs. Each pose waits for closed callouts, a restored full viewport, animation-frame settling, and a GPU fence. Its strict gate allows at most 0.001% of pixels differing by more than one channel level and mean absolute channel difference at most 0.001. Exact decoded geometry provides a separate data-level guarantee.

Browser tests cover normal loading under the shipped CSP, exactly one optimized request and one request per record map, unsupported gzip/WASM without an unused package download, corrupt package and failed-request recovery, no-WebGL with zero heavy-asset requests, and context loss. Existing tests continue to cover mobile gestures, focus, hover/picking, rail layout, both themes, music, and deep inspection.

Verification passed in an isolated copy of the staged sources: TypeScript, 54 unit tests, 38 production browser tests, the production build, and formatting. All staged application files were checked against that tested copy byte for byte; concurrent observability edits were preserved separately.

## Reproduce

Build baseline commit `fb975e3` in a separate checkout and preserve its `dist/client` as `artifacts/performance/initial-load/baseline`. Build the current revision with the same lockfile/runtime; this also regenerates the lossless package. Use the recorded Node 22.17.1 runtime for byte-for-byte gzip reproduction, since compressed output can vary between Node/zlib versions while decoding to identical geometry. Serve the two static production builds in separate terminals:

```sh
yarn vite preview --config vite.static.config.ts --outDir artifacts/performance/initial-load/baseline --host 127.0.0.1 --port 3100 --strictPort
yarn vite preview --config vite.static.config.ts --outDir dist/client --host 127.0.0.1 --port 3101 --strictPort
```

Then run the checks sequentially, with no other browser/GPU workload or rebuild during measurement:

```sh
yarn typecheck
yarn test
EXHIBIT_BASE_URL=http://127.0.0.1:3101 yarn test:e2e
node scripts/compare-render-quality.mjs --baseline=http://127.0.0.1:3100 --candidate=http://127.0.0.1:3101 --out=artifacts/performance/initial-load/quality
node scripts/benchmark-initial-load.mjs --baseline=http://127.0.0.1:3100 --candidate=http://127.0.0.1:3101 --runs=7 --profiles=desktop,mobile --out=artifacts/performance/initial-load/cold-load.json
node scripts/benchmark-initial-load.mjs --baseline=http://127.0.0.1:3100 --candidate=http://127.0.0.1:3101 --runs=3 --profiles=desktop,mobile --mode=fallback --out=artifacts/performance/initial-load/fallback.json
yarn format:check
```

The benchmark rejects software GPU runs, unexpected browser errors, and an accidental photograph fallback in scene mode. Photo-mode runs reject unused geometry/record-map downloads. It records per-resource timings, transfers, long tasks, shader calls, browser/renderer metadata, and readiness for every sample.
