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

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          // If it's a refresh token error, clear the session
          if (error.message?.includes('refresh') || error.message?.includes('Refresh Token')) {
            console.log('🔄 Refresh token invalid, clearing session...')
            await clearSession()
          } else {
            setError(error)
          }
        } else {
          setSession(session)
        }
      } catch (err: unknown) {
        console.error('Unexpected error getting session:', err)
        // Clear session on any auth error
        await clearSession()
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state change:', event, session ? 'Session exists' : 'No session')
      
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