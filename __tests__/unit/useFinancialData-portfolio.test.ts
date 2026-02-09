/**
 * useFinancialData passes portfolioId to fetchProjects.
 * Financials portfolio filter – optional checklist.
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useFinancialData } from '@/app/financials/hooks/useFinancialData'
import * as api from '@/app/financials/utils/api'

jest.mock('@/app/financials/utils/api', () => ({
  fetchProjects: jest.fn(),
  fetchFinancialAlerts: jest.fn(),
  fetchComprehensiveReport: jest.fn(),
}))

jest.mock('@/lib/api', () => ({ getApiUrl: () => 'http://localhost:3000' }))

describe('useFinancialData portfolio filter', () => {
  beforeEach(() => {
    jest.mocked(api.fetchProjects).mockResolvedValue([])
    jest.mocked(api.fetchFinancialAlerts).mockResolvedValue([])
    jest.mocked(api.fetchComprehensiveReport).mockResolvedValue({
      summary: {},
      budget_breakdown: [],
      variance_analysis: [],
      recommendations: [],
    })
  })

  it('calls fetchProjects with portfolioId when provided', async () => {
    const portfolioId = 'pf-123'
    renderHook(() =>
      useFinancialData({
        accessToken: 'token',
        selectedCurrency: 'USD',
        portfolioId,
      })
    )

    await waitFor(() => {
      expect(api.fetchProjects).toHaveBeenCalledWith('token', portfolioId)
    })
  })

  it('calls fetchProjects without portfolioId when not provided', async () => {
    renderHook(() =>
      useFinancialData({
        accessToken: 'token',
        selectedCurrency: 'USD',
      })
    )

    await waitFor(() => {
      expect(api.fetchProjects).toHaveBeenCalledWith('token', undefined)
    })
  })

  it('calls fetchProjects with undefined when portfolioId is null', async () => {
    renderHook(() =>
      useFinancialData({
        accessToken: 'token',
        selectedCurrency: 'USD',
        portfolioId: null,
      })
    )

    await waitFor(() => {
      expect(api.fetchProjects).toHaveBeenCalledWith('token', undefined)
    })
  })
})
