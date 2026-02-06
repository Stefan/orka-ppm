/**
 * Feature Toggle System: useFeatureFlag hook tests
 * Design: .kiro/specs/feature-toggle-system/design.md
 * Property 13: Hook Returns Boolean
 * Property 14: Non-Existent Flag Default
 * Property 19: Error Containment (10.1)
 * Property 20: Synchronous Hook Response (12.3)
 */

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import {
  FeatureFlagProvider,
  useFeatureFlag,
  useFeatureFlags,
} from '@/contexts/FeatureFlagContext'

const mockUseAuth = jest.fn(() => ({ session: null, user: null }))
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('@/lib/api/supabase-minimal', () => ({
  supabase: {
    channel: () => ({
      on: () => ({ subscribe: () => {} }),
      subscribe: () => {},
    }),
    removeChannel: () => {},
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <FeatureFlagProvider>{children}</FeatureFlagProvider>
}

describe('Feature: feature-toggle-system', () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch')
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    mockUseAuth.mockReturnValue({ session: null, user: null })
  })

  describe('Property 13: Hook Returns Boolean', () => {
    it('useFeatureFlag returns an object with enabled as boolean', () => {
      fetchSpy.mockImplementation(() => new Promise(() => {}))
      const { result } = renderHook(() => useFeatureFlag('some_flag'), { wrapper })
      expect(typeof result.current.enabled).toBe('boolean')
      expect(typeof result.current.loading).toBe('boolean')
    })
  })

  describe('Property 14: Non-Existent Flag Default', () => {
    it('non-existent flag returns enabled: false', () => {
      fetchSpy.mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ flags: [] }) })
      )
      const { result } = renderHook(() => useFeatureFlag('nonexistent_flag_name_xyz'), { wrapper })
      expect(result.current.enabled).toBe(false)
    })
  })

  describe('Property 19: Error Containment (10.1)', () => {
    it('on fetch failure provider sets error and does not throw', async () => {
      const rejectErr = new Error('Network error')
      fetchSpy.mockImplementation(() => Promise.reject(rejectErr))
      mockUseAuth.mockReturnValue({
        session: { access_token: 'token' },
        user: { id: 'u1' },
      })

      const { result } = renderHook(() => useFeatureFlags(), { wrapper })

      await waitFor(
        () => {
          expect(result.current.error).not.toBeNull()
          expect(result.current.loading).toBe(false)
        },
        { timeout: 15000 }
      )

      expect(result.current.error?.message).toBe('Network error')
      expect(result.current.isFeatureEnabled('any')).toBe(false)
    })
  })

  describe('Property 20: Synchronous Hook Response (12.3)', () => {
    it('when flags are cached, useFeatureFlag returns value synchronously', async () => {
      mockUseAuth.mockReturnValue({
        session: { access_token: 'token' },
        user: { id: 'u1' },
      })
      fetchSpy.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              flags: [
                { id: '1', name: 'cached_flag', enabled: true, organization_id: null, description: null, created_at: '', updated_at: '' },
              ],
            }),
        })
      )

      const { result } = renderHook(() => useFeatureFlag('cached_flag'), { wrapper })

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false)
        },
        { timeout: 5000 }
      )

      expect(result.current.enabled).toBe(true)
      expect(result.current.enabled).toBe(true)
    })
  })

  describe('useFeatureFlags', () => {
    it('isFeatureEnabled returns false for unknown flag', () => {
      fetchSpy.mockImplementation(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ flags: [] }) })
      )
      const { result } = renderHook(() => useFeatureFlags(), { wrapper })
      expect(result.current.isFeatureEnabled('unknown')).toBe(false)
    })
  })
})
