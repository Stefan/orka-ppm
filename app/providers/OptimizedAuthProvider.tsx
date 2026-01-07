'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase-minimal'
import type { Session, User } from '@supabase/supabase-js'
import { AuthError } from '@supabase/supabase-js'

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

export function OptimizedAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AuthError | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
  }, [])

  const clearSession = async () => {
    try {
      console.log('🧹 Clearing session...')
      await supabase.auth.signOut({ scope: 'local' })
      setSession(null)
      setError(null)
      
      // Clear localStorage
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

    // Optimized auth initialization
    const initializeAuth = async () => {
      try {
        // Quick session check with timeout
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        })
        
        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any
        
        if (error) {
          console.error('Auth error:', error)
          if (error.message?.includes('refresh') || error.message?.includes('Refresh Token')) {
            console.log('🔄 Invalid refresh token, clearing session...')
            await clearSession()
          } else {
            setError(error)
          }
        } else {
          setSession(session)
          if (session) {
            console.log('✅ Session restored successfully')
          }
        }
      } catch (err: unknown) {
        console.error('Auth initialization error:', err)
        // Don't clear session on timeout - might be network issue
        if (err instanceof Error && err.message.includes('timeout')) {
          setError(new AuthError('Connection timeout - please refresh'))
        } else {
          await clearSession()
        }
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Optimized auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event)
      
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setError(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session)
        setError(null)
      }
      
      setLoading(false)
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
    throw new Error('useAuth must be used within an OptimizedAuthProvider')
  }
  return context
}