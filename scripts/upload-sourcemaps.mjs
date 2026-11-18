import { SentryCli } from '@sentry/cli'
import { readdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), '')
if (!env.SENTRY_AUTH_TOKEN) {
  console.info('Sentry source-map upload skipped: no build token configured.')
} else {
  const cli = new SentryCli(undefined, {
    authToken: env.SENTRY_AUTH_TOKEN,
    org: 'purcena-barnabe',
    project: 'golden-record',
    url: 'https://sentry.io',
  })
  const release =
    env.VITE_SENTRY_RELEASE || env.SENTRY_RELEASE || env.GITHUB_SHA || env.CF_PAGES_COMMIT_SHA
  if (release) await cli.releases.new(release)
  // Inject into the final output so the uploaded map and browser code use identical offsets.
  const ignoreRuntime = ['--ignore', '**/rolldown-runtime-*.js']
  await cli.execute(['sourcemaps', 'inject', ...ignoreRuntime, 'dist/client'], true)
  await cli.execute(
    [
      'sourcemaps',
      'upload',
      '--no-rewrite',
      ...ignoreRuntime,
      ...(release ? ['--release', release] : []),
      'dist/client',
    ],
    true,
  )
  if (release) await cli.releases.finalize(release)
  // Keep maps out of Pages; an upload failure deliberately fails the build before deletion.
  for (const path of await readdir('dist/client', { recursive: true }))
    if (path.endsWith('.map')) await unlink(join('dist/client', path))
}
