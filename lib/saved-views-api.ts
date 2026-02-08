/**
 * Saved Views API – No-Code-Views (Cora-Surpass Phase 2.3).
 * Client helpers for /api/saved-views (proxied to backend /saved-views).
 */

import { getApiUrl } from '@/lib/api'

export interface SavedViewDefinition {
  filters?: Record<string, unknown>
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  visibleColumns?: string[]
  pageSize?: number
}

export interface SavedView {
  id: string
  user_id: string
  organization_id: string | null
  name: string
  scope: string
  definition: SavedViewDefinition
  created_at: string
  updated_at: string
}

export async function fetchSavedViews(
  accessToken: string,
  scope?: string
): Promise<SavedView[]> {
  const url = scope
    ? getApiUrl(`/api/saved-views?scope=${encodeURIComponent(scope)}`)
    : getApiUrl('/api/saved-views')
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
  return res.json()
}

export async function createSavedView(
  accessToken: string,
  payload: { name: string; scope: string; definition: SavedViewDefinition }
): Promise<SavedView> {
  const res = await fetch(getApiUrl('/api/saved-views'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
  return res.json()
}

export async function deleteSavedView(
  accessToken: string,
  viewId: string
): Promise<void> {
  const res = await fetch(getApiUrl(`/api/saved-views/${viewId}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 204) throw new Error(await res.text().catch(() => res.statusText))
}
