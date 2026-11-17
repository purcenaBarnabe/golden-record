import { defineConfig } from 'vite'

// The exhibit is a static TanStack Start export. Its local production server
// deliberately omits Start's SSR preview middleware.
export default defineConfig({ appType: 'spa' })
