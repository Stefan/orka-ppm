'use client'

/**
 * Phase 1 – Security & Scalability: Global Error Handling
 * Enterprise Readiness: Next.js global error boundary (root layout fallback)
 */

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { getOrCreateCorrelationId } from '@/lib/enterprise/correlation-id'
import { enterpriseLogger } from '@/lib/enterprise/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const correlationId = getOrCreateCorrelationId()

  useEffect(() => {
    enterpriseLogger.error('GlobalError caught', {
      message: error.message,
      digest: error.digest,
      correlation_id: correlationId,
    })
  }, [error, correlationId])

  return (
    <html lang="de">
      <body className="min-h-screen bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">
            Etwas ist schiefgelaufen
          </h1>
          <p className="text-gray-600 dark:text-slate-400 mb-4">
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-4 font-mono">
            Referenz: {correlationId}
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  )
}
