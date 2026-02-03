/**
 * Data-Migration: Preferences/sync compatibility with old stored shapes
 * Enterprise Test Strategy - Section 6 (Phase 2)
 * Ensures old preference payloads do not crash and defaults are applied.
 */

import {
  getDefaultPreferences,
  userPreferences,
} from '@/lib/sync/storage'

/** Merge old/partial payload with defaults so reader does not throw and result is usable */
function applyDefaults(
  userId: string,
  old: Record<string, unknown>
): Record<string, unknown> {
  const def = getDefaultPreferences(userId) as Record<string, unknown>
  const dashboard = old.dashboard != null && typeof old.dashboard === 'object'
    ? { ...(def.dashboard as Record<string, unknown>), ...(old.dashboard as Record<string, unknown>) }
    : def.dashboard
  const notifications = old.notifications != null && typeof old.notifications === 'object'
    ? { ...(def.notifications as Record<string, unknown>), ...(old.notifications as Record<string, unknown>) }
    : def.notifications
  return {
    ...def,
    ...old,
    userId: old.userId ?? def.userId,
    dashboard,
    notifications,
    lastSync: old.lastSync ?? def.lastSync,
    createdAt: old.createdAt ?? def.createdAt,
    updatedAt: new Date().toISOString(),
  }
}

describe('Migration: Preferences compatibility', () => {
  beforeEach(() => {
    userPreferences.clear()
  })

  it('getDefaultPreferences returns full structure and does not throw', () => {
    const result = getDefaultPreferences('user-1')
    expect(result).toHaveProperty('userId', 'user-1')
    expect(result).toHaveProperty('theme')
    expect(result).toHaveProperty('language')
    expect(result).toHaveProperty('notifications')
    expect(result.notifications).toHaveProperty('email')
    expect(result.notifications).toHaveProperty('push')
    expect(result.notifications).toHaveProperty('desktop')
    expect(result).toHaveProperty('dashboard')
    expect(result.dashboard).toHaveProperty('layout')
    expect(Array.isArray(result.dashboard.widgets)).toBe(true)
    expect(result).toHaveProperty('lastSync')
    expect(result).toHaveProperty('createdAt')
    expect(result).toHaveProperty('updatedAt')
  })

  it('old payload missing dashboard.widgets merges with defaults and is usable', () => {
    const userId = 'user-2'
    const oldPayload = {
      userId,
      theme: 'dark' as const,
      language: 'de',
      dashboard: { layout: 'list' as const },
      lastSync: '2023-01-01T00:00:00Z',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
    }
    const merged = applyDefaults(userId, oldPayload) as ReturnType<typeof getDefaultPreferences>
    expect(() => userPreferences.set(userId, merged)).not.toThrow()
    const got = userPreferences.get(userId)
    expect(got).toBeDefined()
    expect(got?.theme).toBe('dark')
    expect(got?.language).toBe('de')
    expect(got?.dashboard.layout).toBe('list')
    expect(Array.isArray(got?.dashboard.widgets)).toBe(true)
  })

  it('old payload missing notifications yields merged preferences', () => {
    const userId = 'user-3'
    const oldPayload = {
      userId,
      theme: 'light' as const,
      language: 'en',
      lastSync: '2023-06-01T00:00:00Z',
      createdAt: '2023-06-01T00:00:00Z',
      updatedAt: '2023-06-01T00:00:00Z',
    }
    const merged = applyDefaults(userId, oldPayload) as ReturnType<typeof getDefaultPreferences>
    expect(() => userPreferences.set(userId, merged)).not.toThrow()
    const got = userPreferences.get(userId)
    expect(got?.notifications).toBeDefined()
    expect(typeof got?.notifications.email).toBe('boolean')
  })

  it('update with partial does not throw and preserves existing fields', () => {
    const userId = 'user-4'
    const full = getDefaultPreferences(userId)
    userPreferences.set(userId, full)
    const updated = userPreferences.update(userId, { theme: 'dark' })
    expect(updated).not.toBeNull()
    expect(updated?.theme).toBe('dark')
    expect(updated?.language).toBe(full.language)
  })
})
