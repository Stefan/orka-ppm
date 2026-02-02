/**
 * Phase 3 – Real-time Presence (stub / Supabase Realtime)
 * Enterprise Readiness: Presence, Comments, @-Mentions
 */

import { useState, useEffect, useCallback } from 'react'
import type { PresenceUser } from '@/types/enterprise'

export interface UsePresenceOptions {
  channelId: string
  userId: string
  enabled?: boolean
}

/**
 * Stub: Gibt leere Präsenz zurück.
 * Für echte Präsenz: Supabase Realtime channel(channelId).on('presence', { sync: ... }) nutzen.
 */
export function usePresence({ channelId, userId, enabled = true }: UsePresenceOptions) {
  const [users, setUsers] = useState<PresenceUser[]>([])
  const [online, setOnline] = useState(false)

  const join = useCallback(() => {
    if (!enabled) return
    setOnline(true)
    setUsers((prev) => {
      if (prev.some((u) => u.user_id === userId)) return prev
      return [...prev, { user_id: userId, online_at: new Date().toISOString() }]
    })
  }, [channelId, userId, enabled])

  const leave = useCallback(() => {
    setOnline(false)
    setUsers((prev) => prev.filter((u) => u.user_id !== userId))
  }, [userId])

  useEffect(() => {
    if (!enabled) return
    join()
    return () => leave()
  }, [enabled, join, leave])

  return { users, online, join, leave }
}
