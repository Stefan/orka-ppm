'use client'

import { useEffect } from 'react'

/**
 * Root page - redirects to /login.
 * The main redirect is configured in next.config.ts (redirects).
 * This component serves as a fallback if config redirect doesn't apply.
 */
export default function HomePage() {
  useEffect(() => {
    window.location.replace('/login')
  }, [])

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}
    >
      <div className="text-center" style={{ textAlign: 'center' }}>
        <div
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
          style={{ width: 48, height: 48, borderWidth: 2, borderColor: '#2563eb', borderRadius: '50%', borderTopColor: 'transparent' }}
        />
        <p className="mt-4 text-gray-600" style={{ marginTop: 16, color: '#4b5563' }}>
          Redirecting...
        </p>
      </div>
    </div>
  )
}
