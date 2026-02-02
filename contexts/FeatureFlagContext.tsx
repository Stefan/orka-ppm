'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { getApiUrl } from '@/lib/api'
import { supabase } from '@/lib/api/supabase-minimal'
import type { FeatureFlag, FeatureFlagsContextValue } from '@/types/feature-flags'

const FeatureFlagsContext = createContext<FeatureFlagsContextValue | undefined>(
  undefined
)

const RETRY_DELAYS_MS = [1000, 2000, 4000]
const MAX_RETRIES = 3

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const { session, user } = useAuth()
  const [flags, setFlags] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchFlags = useCallback(async () => {
    setLoading(true)
    setError(null)
    let lastErr: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use relative URL to go through Next.js API route (not getApiUrl which might point to backend)
        const url = '/api/features'
        const headers: HeadersInit = {}
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
        const response = await fetch(url, { headers })

        if (!response.ok) {
          if (response.status === 401) {
            setFlags(new Map())
            setLoading(false)
            return
          }
          throw new Error(`Failed to fetch feature flags: ${response.status}`)
        }

        const data = await response.json()
        const flagMap = new Map<string, boolean>()
        const list = data?.flags ?? []
        for (const flag of list as FeatureFlag[]) {
          flagMap.set(flag.name, flag.enabled)
        }
        setFlags(flagMap)
        setError(null)
        setLoading(false)
        return
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err))
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
        }
      }
    }

    setError(lastErr)
    setLoading(false)
    // Keep previous flags on error (cache)
  }, [session?.access_token])

  useEffect(() => {
    fetchFlags()
  }, [fetchFlags])

  useEffect(() => {
    if (!user) return

    const channel = supabase.channel('feature_flags_changes')
    const handler = (payload: { payload?: { action?: string; flag?: FeatureFlag & { name?: string } } }) => {
      const { action, flag } = payload?.payload ?? {}
      if (!flag || !flag.name) return
      setFlags((prev) => {
        const next = new Map(prev)
        if (action === 'deleted') {
          next.delete(flag.name!)
        } else {
          next.set(flag.name!, (flag as FeatureFlag).enabled ?? false)
        }
        return next
      })
    }
    channel.on('broadcast', { event: 'flag_change' }, handler).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const isFeatureEnabled = useCallback(
    (flagName: string): boolean => {
      return flags.get(flagName) ?? false
    },
    [flags]
  )

  const value: FeatureFlagsContextValue = {
    flags,
    loading,
    error,
    isFeatureEnabled,
    refreshFlags: fetchFlags,
  }

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  )
}

export function useFeatureFlags(): FeatureFlagsContextValue {
  const context = useContext(FeatureFlagsContext)
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider')
  }
  return context
}

export function useFeatureFlag(flagName: string): { enabled: boolean; loading: boolean } {
  const { flags, loading, isFeatureEnabled } = useFeatureFlags()
  return {
    enabled: isFeatureEnabled(flagName),
    loading,
  }
}
