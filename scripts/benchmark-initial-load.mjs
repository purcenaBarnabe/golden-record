import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
)
const runs = Number(options.runs ?? 5)
const profiles = (options.profiles ?? 'desktop,mobile').split(',')
const variants = options.url
  ? [[options.label ?? 'candidate', options.url]]
  : [
      ['baseline', options.baseline],
      ['candidate', options.candidate],
    ]
if (!variants.every(([, url]) => url) || !Number.isInteger(runs) || runs < 1)
  throw new Error('Use --url=URL or --baseline=URL --candidate=URL, with --runs=N and --out=FILE.')
const output = options.out ?? 'artifacts/performance/initial-load/results.json'
const mode = options.mode ?? 'scene'
if (!['scene', 'fallback'].includes(mode)) throw new Error('Use --mode=scene or --mode=fallback')
await fs.mkdir(path.dirname(output), { recursive: true })

function observeStartup({ mode }) {
  const probe = (window.__initialLoadProbe = {
    readyAt: 0,
    firstFrameAt: 0,
    firstDrawAt: 0,
    draws: 0,
    shaderCalls: {},
    longTasks: [],
  })
  performance.setResourceTimingBufferSize(2000)
  if (mode === 'fallback') {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.includes('webgl') ? null : getContext.call(this, type, ...args)
    }
  }
  try {
    new PerformanceObserver((list) => {
      probe.longTasks.push(
        ...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })),
      )
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    /* Long Task API is optional. */
  }
  new MutationObserver(() => {
    if (!probe.readyAt && document.querySelector('#artifact[aria-busy="false"]'))
      probe.readyAt = performance.now()
    if (mode === 'fallback' && !probe.photoWaiting) {
      const photo = document.querySelector('.webgl-fallback img')
      if (photo) {
        probe.photoWaiting = true
        photo.decode().then(() =>
          requestAnimationFrame(() => {
            probe.firstFrameAt = performance.now()
          }),
        )
      }
    }
  }).observe(document, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ['aria-busy'],
  })
  const framebuffers = new WeakMap()
  const proto = WebGL2RenderingContext.prototype
  const bind = proto.bindFramebuffer
  proto.bindFramebuffer = function (target, framebuffer) {
    if (target === this.FRAMEBUFFER || target === this.DRAW_FRAMEBUFFER)
      framebuffers.set(this, framebuffer)
    return bind.apply(this, arguments)
  }
  for (const name of [
    'drawElements',
    'drawArrays',
    'drawElementsInstanced',
    'drawArraysInstanced',
  ]) {
    const original = proto[name]
    proto[name] = function () {
      const result = original.apply(this, arguments)
      if (!framebuffers.get(this)) {
        probe.draws++
        if (!probe.firstDrawAt) {
          probe.firstDrawAt = performance.now()
          requestAnimationFrame(() => {
            // Verify that the complete first scene frame has left the GPU queue.
            const fence = this.fenceSync(this.SYNC_GPU_COMMANDS_COMPLETE, 0)
            this.flush()
            const completed = () => {
              const status = this.clientWaitSync(fence, 0, 0)
              if (status === this.ALREADY_SIGNALED || status === this.CONDITION_SATISFIED) {
                this.deleteSync(fence)
                probe.firstFrameAt = performance.now()
              } else requestAnimationFrame(completed)
            }
            completed()
          })
        }
      }
      return result
    }
  }
  for (const name of [
    'compileShader',
    'linkProgram',
    'getProgramParameter',
    'getShaderParameter',
  ]) {
    const original = proto[name]
    proto[name] = function () {
      const start = performance.now()
      const result = original.apply(this, arguments)
      const item = (probe.shaderCalls[name] ??= { count: 0, duration: 0 })
      item.count++
      item.duration += performance.now() - start
      return result
    }
  }
}

const report = {
  createdAt: new Date().toISOString(),
  mode,
  host: {
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0]?.model,
    node: process.version,
  },
  methodology:
    'Fresh Chrome process/context per sample; HTTP cache and service workers disabled; identical readiness probes; reduced-motion enabled. ' +
    (mode === 'scene'
      ? 'Hardware GPU. Ready = later of controls-ready and a GPU fence completing after the entire first main-framebuffer scene frame. '
      : 'WebGL unavailable. Ready = later of controls-ready and a decoded reference photograph followed by an animation frame. ') +
    'Alternating variant order per pair.',
  profiles: {
    desktop: {
      viewport: { width: 1440, height: 1000 },
      dpr: 1,
      cpuRate: 1,
      latencyMs: 0,
      downloadBytesPerSecond: -1,
    },
    mobile: {
      viewport: { width: 390, height: 844 },
      dpr: 2,
      cpuRate: 4,
      latencyMs: 40,
      downloadBytesPerSecond: 1_250_000,
    },
  },
  samples: [],
}

for (const profileName of profiles) {
  const profile = report.profiles[profileName]
  if (!profile) throw new Error(`Unknown profile ${profileName}`)
  for (let run = 0; run < runs; run++) {
    for (const [variant, url] of run % 2 ? [...variants].reverse() : variants) {
      const browser = await chromium.launch({
        channel: 'chrome',
        args: ['--enable-webgl', '--ignore-gpu-blocklist', '--disable-gpu-shader-disk-cache'],
      })
      try {
        const page = await browser.newPage({
          viewport: profile.viewport,
          deviceScaleFactor: profile.dpr,
          isMobile: profileName === 'mobile',
          hasTouch: profileName === 'mobile',
          serviceWorkers: 'block',
        })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
        await page.addInitScript(observeStartup, { mode })
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Network.enable')
        await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: profile.latencyMs,
          downloadThroughput: profile.downloadBytesPerSecond,
          uploadThroughput: profile.downloadBytesPerSecond,
        })
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate })
        await cdp.send('Performance.enable')
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 })
        await page.waitForFunction(
          () => window.__initialLoadProbe.readyAt && window.__initialLoadProbe.firstFrameAt,
          null,
          { timeout: 120_000 },
        )
        await page.waitForFunction(
          (mode) =>
            (mode === 'fallback' || !document.querySelector('.webgl-fallback')) &&
            !document.querySelector('.surface-switch')?.disabled,
          mode,
        )
        const sample = await page.evaluate(() => {
          const probe = window.__initialLoadProbe
          const ready = Math.max(probe.readyAt, probe.firstFrameAt)
          const navigation = performance.getEntriesByType('navigation')[0]
          const resources = performance
            .getEntriesByType('resource')
            .map(
              ({
                name,
                startTime,
                responseStart,
                responseEnd,
                duration,
                transferSize,
                encodedBodySize,
                decodedBodySize,
                initiatorType,
              }) => ({
                name,
                startTime,
                responseStart,
                responseEnd,
                duration,
                transferSize,
                encodedBodySize,
                decodedBodySize,
                initiatorType,
              }),
            )
          const gl = document.querySelector('canvas')?.getContext('webgl2')
          const debug = gl?.getExtension('WEBGL_debug_renderer_info')
          return {
            readyMs: ready,
            controlsReadyMs: probe.readyAt,
            firstSceneDrawMs: probe.firstDrawAt,
            firstSceneFrameMs: probe.firstFrameAt,
            ttfbMs: navigation.responseStart,
            firstContentfulPaintMs:
              performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
            startupBytes:
              navigation.transferSize +
              resources
                .filter((r) => r.responseEnd <= ready)
                .reduce((sum, r) => sum + r.transferSize, 0),
            longTasks: probe.longTasks.filter((task) => task.startTime < ready),
            shaderCalls: probe.shaderCalls,
            mainDrawCalls: probe.draws,
            renderer: gl
              ? gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
              : 'reference-photo fallback',
            resources,
          }
        })
        if (/SwiftShader|llvmpipe|software rasterizer/i.test(sample.renderer))
          throw new Error(`Software GPU is not a valid hardware comparison: ${sample.renderer}`)
        if (
          mode === 'fallback' &&
          sample.resources.some((resource) =>
            /cover-relief\.|record-(albedo|roughness|anisotropy|relief)\.webp/.test(resource.name),
          )
        )
          throw new Error('The no-WebGL path downloaded unused geometry or record texture maps')
        const unexpected =
          mode === 'fallback'
            ? errors.filter((error) => !/WebGL|Error creating|The above error occurred/.test(error))
            : errors
        if (unexpected.length) throw new Error(unexpected.join('\n'))
        const { metrics } = await cdp.send('Performance.getMetrics')
        sample.metrics = Object.fromEntries(
          metrics
            .filter(({ name }) =>
              ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'JSHeapUsedSize'].includes(name),
            )
            .map(({ name, value }) => [name, value]),
        )
        report.samples.push({
          variant,
          profile: profileName,
          run: run + 1,
          url,
          browser: browser.version(),
          ...sample,
        })
        await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n')
        console.log(
          `${variant} ${profileName} ${run + 1}/${runs}: ready ${sample.readyMs.toFixed(0)} ms; transfer ${(sample.startupBytes / 1048576).toFixed(2)} MiB; long tasks ${sample.longTasks.reduce((sum, task) => sum + task.duration, 0).toFixed(0)} ms`,
        )
        if (options.screenshots && run === 0) {
          await fs.mkdir(options.screenshots, { recursive: true })
          await page.screenshot({
            path: path.join(options.screenshots, `${variant}-${profileName}.png`),
          })
        }
      } finally {
        await browser.close()
      }
    }
  }
}
