import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.EXHIBIT_BASE_URL || 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 1000 },
    launchOptions: { channel: 'chrome', args: ['--enable-webgl', '--ignore-gpu-blocklist'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: process.env.EXHIBIT_BASE_URL
    ? undefined
    : {
        command: 'yarn dev',
        // Routine UI tests must never send synthetic errors to the real project.
        env: { VITE_SENTRY_DSN: process.env.PLAYWRIGHT_SENTRY_DSN || '' },
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: false,
        timeout: 30_000,
      },
})
