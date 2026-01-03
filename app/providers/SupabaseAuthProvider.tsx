'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Session, User } from '@supabase/supabase-js'

const AuthContext = createContext<{ session: Session | null; user: User | undefined }>({
  session: null,
  user: undefined,
})

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user: session?.user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)