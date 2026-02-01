/**
 * Feature Toggle System: Integration tests (Task 26)
 * - API response shape → context → isFeatureEnabled
 * - filterFlagsBySearch with API-shaped list (admin table filtering)
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { FeatureFlagProvider, useFeatureFlags, useFeatureFlag } from '@/contexts/FeatureFlagContext'
import { filterFlagsBySearch } from '@/lib/feature-flags/filterFlags'
import type { FeatureFlag } from '@/types/feature-flags'

const mockUseAuth = jest.fn(() => ({ session: null, user: null }))
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))
jest.mock('@/lib/api/supabase-minimal', () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => {} }), subscribe: () => {} }),
    removeChannel: () => {},
  },
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <FeatureFlagProvider>{children}</FeatureFlagProvider>
}

describe('Feature Toggle Workflow Integration (Task 26)', () => {
  describe('API response → context → isFeatureEnabled', () => {
    it('GET /api/features response populates context and isFeatureEnabled reflects it', async () => {
      mockUseAuth.mockReturnValue({
        session: { access_token: 'token' },
        user: { id: 'u1' },
      })
      const apiFlags: FeatureFlag[] = [
        { id: '1', name: 'costbook_phase1', enabled: true, organization_id: null, description: 'Costbook v1', created_at: '', updated_at: '' },
        { id: '2', name: 'ai_anomaly_detection', enabled: false, organization_id: null, description: 'AI anomalies', created_at: '', updated_at: '' },
      ]
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ flags: apiFlags }),
        })
      ) as jest.Mock

      const { result } = renderHook(() => useFeatureFlags(), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 })

      expect(result.current.isFeatureEnabled('costbook_phase1')).toBe(true)
      expect(result.current.isFeatureEnabled('ai_anomaly_detection')).toBe(false)
      expect(result.current.isFeatureEnabled('unknown')).toBe(false)
    })

    it('useFeatureFlag(flagName) returns enabled/loading consistent with context', async () => {
      mockUseAuth.mockReturnValue({
        session: { access_token: 'token' },
        user: { id: 'u1' },
      })
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              flags: [{ id: '1', name: 'nested_grids', enabled: true, organization_id: null, description: null, created_at: '', updated_at: '' }],
            }),
        })
      ) as jest.Mock

      const { result } = renderHook(() => useFeatureFlag('nested_grids'), { wrapper })

      await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 3000 })

      expect(result.current.enabled).toBe(true)
    })
  })

  describe('Admin table filtering (filterFlagsBySearch with API-shaped list)', () => {
    const apiShapedFlags: FeatureFlag[] = [
      { id: '1', name: 'costbook_phase1', enabled: true, organization_id: null, description: null, created_at: '', updated_at: '' },
      { id: '2', name: 'Costbook_Phase2', enabled: false, organization_id: null, description: null, created_at: '', updated_at: '' },
      { id: '3', name: 'AI_ANOMALY_DETECTION', enabled: false, organization_id: null, description: null, created_at: '', updated_at: '' },
    ]

    it('filtered list matches what admin table would display', () => {
      const filtered = filterFlagsBySearch(apiShapedFlags, 'costbook')
      expect(filtered).toHaveLength(2)
      expect(filtered.map((f) => f.name)).toEqual(['costbook_phase1', 'Costbook_Phase2'])
    })

    it('empty search returns full list (admin table shows all)', () => {
      const filtered = filterFlagsBySearch(apiShapedFlags, '')
      expect(filtered).toHaveLength(3)
    })

    it('case-insensitive query matches (admin search)', () => {
      expect(filterFlagsBySearch(apiShapedFlags, 'AI')).toHaveLength(1)
      expect(filterFlagsBySearch(apiShapedFlags, 'ai')).toHaveLength(1)
    })
  })
})
