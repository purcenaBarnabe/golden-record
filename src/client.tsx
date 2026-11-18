import './instrument.client'
import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import { reactErrorHandler } from '@sentry/react'

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    {
      onUncaughtError: reactErrorHandler(),
      onRecoverableError: reactErrorHandler(),
      // The scene boundary and router report their own caught errors with context.
    },
  )
})
