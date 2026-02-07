'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/api/supabase-minimal'

/**
 * OAuth callback page: Supabase redirects here after IdP login.
 * Client reads session from URL (Supabase handles hash/query), then redirects to /dashboards or /login.
 */
function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      try {
        // Give Supabase client a tick to parse hash/query from OAuth redirect
        await new Promise((r) => setTimeout(r, 100))
        if (cancelled) return
        const { data: { session }, error } = await supabase.auth.getSession()
        if (cancelled) return
        if (error) {
          setStatus('error')
          router.replace(`/login?error=${encodeURIComponent(error.message)}`)
          return
        }
        if (session) {
          setStatus('ok')
          const next = searchParams.get('next') || '/dashboards'
          router.replace(next.startsWith('/') ? next : '/dashboards')
        } else {
          // Retry once in case client was still processing URL
          await new Promise((r) => setTimeout(r, 300))
          if (cancelled) return
          const { data: { session: session2 } } = await supabase.auth.getSession()
          if (session2) {
            setStatus('ok')
            const next = searchParams.get('next') || '/dashboards'
            router.replace(next.startsWith('/') ? next : '/dashboards')
          } else {
            setStatus('error')
            router.replace('/login?error=no_session')
          }
        }
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          router.replace(`/login?error=${encodeURIComponent(e instanceof Error ? e.message : 'callback_failed')}`)
        }
      }
    }

    handleCallback()
    return () => { cancelled = true }
  }, [router, searchParams])

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50"
      data-testid="auth-callback-page"
    >
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600 dark:text-slate-400">
          {status === 'loading' && 'Signing you in…'}
          {status === 'ok' && 'Redirecting…'}
          {status === 'error' && 'Redirecting to login…'}
        </p>
      </div>
    </div>
  )
}

function CallbackFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50" data-testid="auth-callback-page">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-600 dark:text-slate-400">Signing you in…</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
