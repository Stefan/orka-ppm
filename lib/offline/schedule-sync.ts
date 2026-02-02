/**
 * Schedule offline storage and sync (Task 14.2).
 * Cache schedule data for offline access; queue progress updates and sync when online.
 */

const SCHEDULE_CACHE_PREFIX = 'schedule_'
const SCHEDULE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

export interface ScheduleCacheEntry {
  id: string
  data: unknown
  timestamp: number
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function saveScheduleToCache(scheduleId: string, data: unknown): void {
  const storage = getStorage()
  if (!storage) return
  try {
    const key = `${SCHEDULE_CACHE_PREFIX}${scheduleId}`
    const entry: ScheduleCacheEntry = { id: scheduleId, data, timestamp: Date.now() }
    storage.setItem(key, JSON.stringify(entry))
  } catch (e) {
    console.warn('Schedule cache save failed:', e)
  }
}

export function getScheduleFromCache(scheduleId: string): unknown | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const key = `${SCHEDULE_CACHE_PREFIX}${scheduleId}`
    const raw = storage.getItem(key)
    if (!raw) return null
    const entry = JSON.parse(raw) as ScheduleCacheEntry
    if (Date.now() - entry.timestamp > SCHEDULE_CACHE_TTL_MS) return null
    return entry.data
  } catch {
    return null
  }
}

const PENDING_PROGRESS_KEY = 'schedule_pending_progress'

export interface PendingProgressUpdate {
  taskId: string
  updates: { planned_start_date?: string; planned_end_date?: string; progress_percentage?: number }
  timestamp: number
}

export function queueProgressUpdate(taskId: string, updates: PendingProgressUpdate['updates']): void {
  const storage = getStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_PROGRESS_KEY)
    const list: PendingProgressUpdate[] = raw ? JSON.parse(raw) : []
    list.push({ taskId, updates, timestamp: Date.now() })
    storage.setItem(PENDING_PROGRESS_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('Queue progress update failed:', e)
  }
}

export function getPendingProgressUpdates(): PendingProgressUpdate[] {
  const storage = getStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(PENDING_PROGRESS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearPendingProgressUpdates(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(PENDING_PROGRESS_KEY)
  } catch {}
}

export async function syncPendingProgressUpdates(
  accessToken: string | null,
  onSuccess?: () => void
): Promise<void> {
  if (!accessToken) return
  const pending = getPendingProgressUpdates()
  if (pending.length === 0) return
  for (const item of pending) {
    try {
      const res = await fetch(`/api/schedules/tasks/${item.taskId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item.updates),
      })
      if (res.ok) onSuccess?.()
    } catch {
      break
    }
  }
  clearPendingProgressUpdates()
}
