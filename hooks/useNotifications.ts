'use client'

import { useState, useCallback, useEffect } from 'react'

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  read?: boolean
  is_read?: boolean
  read_at?: string | null
  created_at: string
}

const API_BASE = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_APP_URL || ''

export function useNotifications(accessToken: string | undefined) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isUnread = (n: AppNotification) => !((n as AppNotification).is_read ?? (n as AppNotification).read)
  const unreadCount = notifications.filter(isUnread).length

  const fetchNotifications = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || res.statusText)
      }
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data as { notifications?: AppNotification[] }).notifications ?? []
      setNotifications(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications')
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!accessToken) return
      try {
        const res = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) throw new Error('Failed to mark as read')
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read: true, is_read: true, read_at: new Date().toISOString() }
              : n
          )
        )
      } catch {
        // Optimistic: still update local state so UI feels responsive
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true, is_read: true } : n
          )
        )
      }
    },
    [accessToken]
  )

  const markAllAsRead = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) throw new Error('Failed to mark all as read')
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, is_read: true, read_at: new Date().toISOString() }))
      )
    } catch {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, is_read: true }))
      )
    }
  }, [accessToken])

  useEffect(() => {
    if (accessToken) fetchNotifications()
  }, [accessToken, fetchNotifications])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
  }
}
