import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorState } from '@worldbinder/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { bootstrapSession } from './features/auth/session'
import { queryClient } from './lib/queryClient'
import { router } from './routes'
import './styles/global.css'

// Milestone 14 Phase 11 — VITE_SENTRY_DSN unset (the default everywhere
// until a real Sentry project exists) means Sentry.init is simply never
// called: fully inert, not initialized-with-an-empty-DSN. The ErrorBoundary
// below still catches render errors and shows a fallback either way; it
// just has nowhere to report them without a DSN.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE })
}

void bootstrapSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <ErrorState message="Something went wrong loading Worldbinder." onRetry={resetError} />
      )}
    >
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
