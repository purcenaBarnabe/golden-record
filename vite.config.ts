import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const authToken = env.SENTRY_AUTH_TOKEN
  const release =
    env.VITE_SENTRY_RELEASE || env.SENTRY_RELEASE || env.GITHUB_SHA || env.CF_PAGES_COMMIT_SHA
  return {
    define: {
      'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(release || ''),
    },
    plugins: [
      tailwindcss(),
      tanstackStart({ prerender: { enabled: true, crawlLinks: false, failOnError: true } }),
      react(),
    ],
    server: { port: 3000 },
    build: { chunkSizeWarningLimit: 1100, sourcemap: authToken ? 'hidden' : false },
  }
})
