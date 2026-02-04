/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSettings } from '../useSettings'

const mockUpdatePreferences = jest.fn()
const mockInitialize = jest.fn()

jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
  }),
}))

jest.mock('../useCrossDeviceSync', () => ({
  useCrossDeviceSync: () => ({
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      currency: 'USD',
      dashboardLayout: { widgets: [], layout: 'grid' },
      dashboardKPIs: {
        successRateMethod: 'health',
        budgetMethod: 'spent',
        resourceMethod: 'auto',
        resourceFixedValue: 85,
      },
      aiSettings: {
        enableSuggestions: true,
        enablePredictiveText: true,
        enableAutoOptimization: false,
      },
    },
    updatePreferences: (...args: unknown[]) => mockUpdatePreferences(...args),
    initialize: (...args: unknown[]) => mockInitialize(...args),
    isSyncing: false,
  }),
}))

describe('useSettings', () => {
  beforeEach(() => {
    mockUpdatePreferences.mockResolvedValue(undefined)
    mockInitialize.mockResolvedValue(undefined)
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    ;(console.error as jest.Mock).mockRestore()
  })

  it('returns settings, loading, saving, error and actions', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(
      () => {
        expect(result.current.settings).toBeDefined()
        expect(typeof result.current.updateSetting).toBe('function')
      },
      { timeout: 3000 }
    )

    expect(result.current.settings?.theme).toBe('light')
    expect(typeof result.current.updateSettings).toBe('function')
    expect(typeof result.current.resetToDefaults).toBe('function')
    expect(typeof result.current.loading).toBe('boolean')
    expect(typeof result.current.saving).toBe('boolean')
  })

  it('updateSetting calls updatePreferences with single key', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.settings).toBeDefined(), { timeout: 3000 })

    await act(async () => {
      await result.current.updateSetting('theme', 'dark')
    })

    expect(mockUpdatePreferences).toHaveBeenCalledWith({ theme: 'dark' })
  })

  it('updateSettings calls updatePreferences with partial updates', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.settings).toBeDefined(), { timeout: 3000 })

    await act(async () => {
      await result.current.updateSettings({ language: 'de', currency: 'EUR' })
    })

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      language: 'de',
      currency: 'EUR',
    })
  })

  it('resetToDefaults calls updatePreferences with defaults', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.settings).toBeDefined(), { timeout: 3000 })

    await act(async () => {
      await result.current.resetToDefaults()
    })

    expect(mockUpdatePreferences).toHaveBeenCalled()
    const lastCall = mockUpdatePreferences.mock.calls[mockUpdatePreferences.mock.calls.length - 1][0]
    expect(lastCall).toMatchObject({
      theme: 'auto',
      language: 'en',
      currency: 'USD',
    })
  })

  it('sets error when updatePreferences rejects', async () => {
    mockUpdatePreferences.mockRejectedValueOnce(new Error('Save failed'))

    const { result } = renderHook(() => useSettings())

    await waitFor(() => expect(result.current.settings).toBeDefined(), { timeout: 3000 })

    await act(async () => {
      try {
        await result.current.updateSetting('theme', 'dark')
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to save theme')
    })
  })
})
