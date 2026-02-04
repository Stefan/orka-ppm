import {
  userPreferences,
  getDefaultPreferences,
  syncPreferences
} from '../storage'

describe('lib/sync/storage', () => {
  beforeEach(() => {
    userPreferences.clear()
  })

  describe('userPreferences', () => {
    it('get returns undefined when not set', () => {
      expect(userPreferences.get('user-1')).toBeUndefined()
    })

    it('set and get roundtrip', () => {
      const prefs = getDefaultPreferences('user-1')
      userPreferences.set('user-1', prefs)
      expect(userPreferences.get('user-1')).toEqual(prefs)
    })

    it('update merges and returns updated', () => {
      userPreferences.set('user-1', getDefaultPreferences('user-1'))
      const updated = userPreferences.update('user-1', { theme: 'dark', language: 'de' })
      expect(updated).not.toBeNull()
      expect(updated!.theme).toBe('dark')
      expect(updated!.language).toBe('de')
      expect(userPreferences.get('user-1')!.theme).toBe('dark')
    })

    it('update returns null when user not found', () => {
      expect(userPreferences.update('missing', { theme: 'dark' })).toBeNull()
    })

    it('delete removes and returns true', () => {
      userPreferences.set('user-1', getDefaultPreferences('user-1'))
      expect(userPreferences.delete('user-1')).toBe(true)
      expect(userPreferences.get('user-1')).toBeUndefined()
    })

    it('delete returns false when key did not exist', () => {
      expect(userPreferences.delete('missing')).toBe(false)
    })

    it('clear removes all', () => {
      userPreferences.set('user-1', getDefaultPreferences('user-1'))
      userPreferences.clear()
      expect(userPreferences.get('user-1')).toBeUndefined()
    })
  })

  describe('getDefaultPreferences', () => {
    it('returns defaults for userId', () => {
      const prefs = getDefaultPreferences('u1')
      expect(prefs.userId).toBe('u1')
      expect(prefs.theme).toBe('auto')
      expect(prefs.language).toBe('en')
      expect(prefs.notifications.email).toBe(true)
      expect(prefs.dashboard.layout).toBe('grid')
      expect(prefs.dashboard.widgets).toContain('quick-stats')
    })
  })

  describe('syncPreferences', () => {
    it('persists and returns true', async () => {
      const prefs = getDefaultPreferences('u1')
      const result = await syncPreferences('u1', prefs)
      expect(result).toBe(true)
      expect(userPreferences.get('u1')?.lastSync).toBeDefined()
    })
  })
})
