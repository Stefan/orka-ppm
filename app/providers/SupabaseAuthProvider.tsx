'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/api/supabase-minimal'
import type { Session, User, AuthError } from '@supabase/supabase-js'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  error: AuthError | null
  clearSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  error: null,
  clearSession: async () => {},
})

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Prevent hydration mismatch by only running auth logic on client
  useEffect(() => {
    setIsClient(true)
  }, [])

  const clearSession = async () => {
    try {
      console.log('🧹 Clearing invalid session...')
      await supabase.auth.signOut({ scope: 'local' })
      setSession(null)
      setError(null)
      
      // Also clear localStorage manually as backup
      try {
        localStorage.removeItem('ppm-auth-token')
        localStorage.removeItem('supabase.auth.token')
      } catch {
        // Ignore localStorage errors
      }
    } catch (err) {
      console.error('Error clearing session:', err)
    }
  }

  useEffect(() => {
    if (!isClient) return

    // Get initial session (with timeout to prevent infinite loading if Supabase is unreachable)
    const AUTH_TIMEOUT_MS = 8000
    const initializeAuth = async () => {
      try {
        console.log('🔐 Initializing authentication...')
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth timeout')), AUTH_TIMEOUT_MS)
        )
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise])
        
        if (error) {
          console.error('❌ Error getting session:', error)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'SupabaseAuthProvider.tsx:getSession', message: 'getSession_error', data: { msg: error?.message }, hypothesisId: 'H2', timestamp: Date.now() }) }).catch(() => {})
          // #endregion
          // If it's a refresh token error, clear the session
          if (error.message?.includes('refresh') || error.message?.includes('Refresh Token')) {
            console.log('🔄 Refresh token invalid, clearing session...')
            await clearSession()
          } else {
            setError(error)
          }
        } else {
          console.log('✅ Session check complete:', session ? 'Session found' : 'No session')
          // #region agent log
          if (!session) {
            fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'SupabaseAuthProvider.tsx:getSession', message: 'getSession_no_session', data: {}, hypothesisId: 'H3', timestamp: Date.now() }) }).catch(() => {})
          }
          // #endregion
          setSession(session)
        }
      } catch (err: unknown) {
        console.error('🚨 Unexpected error getting session:', err)
        const isTimeout = err instanceof Error && err.message === 'Auth timeout'
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'SupabaseAuthProvider.tsx:getSession', message: 'getSession_catch', data: { isTimeout, msg: err instanceof Error ? err.message : String(err) }, hypothesisId: 'H4', timestamp: Date.now() }) }).catch(() => {})
        // #endregion
        if (isTimeout) {
          console.warn('⏱️ Auth check timed out - showing login form. Supabase may be unreachable.')
          setSession(null)
        } else {
          await clearSession()
        }
      } finally {
        console.log('✅ Auth initialization complete')
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event, session ? 'Session exists' : 'No session')
      // #region agent log
      if (!session) {
        fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'SupabaseAuthProvider.tsx:onAuthStateChange', message: 'auth_state_change_session_null', data: { event }, hypothesisId: 'H1', timestamp: Date.now() }) }).catch(() => {})
      }
      // #endregion
      // Avoid overwriting a valid session with null on INITIAL_SESSION (Supabase can emit null before getSession() result is applied)
      if (event === 'INITIAL_SESSION' && session === null) {
        return
      }
      if (event === 'TOKEN_REFRESHED') {
        console.log('✅ Token refreshed successfully')
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out')
      } else if (event === 'SIGNED_IN') {
        console.log('👤 User signed in')
      }
      
      setSession(session)
      setLoading(false)
      setError(null)
    })

    return () => subscription.unsubscribe()
  }, [isClient])

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    loading,
    error,
    clearSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within a SupabaseAuthProvider')
  }
  return context
}