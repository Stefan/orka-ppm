/**
 * Unit tests for Admin Help Analytics page
 * Requirements: 4.1, 4.2, 4.3, 4.7 (Task 7.8)
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AdminHelpAnalyticsPage from '@/app/admin/help-analytics/page'

const mockUseAuth = jest.fn()
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('@/components/shared/AppLayout', () => {
  return function MockAppLayout({ children }: { children: React.ReactNode }) {
    return <div data-testid="app-layout">{children}</div>
  }
})

describe('Admin Help Analytics Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({ session: null })
  })

  it('renders page with Help Chat Analytics heading', () => {
    render(<AdminHelpAnalyticsPage />)
    expect(screen.getByText('Help Chat Analytics')).toBeInTheDocument()
    expect(screen.getByText(/Usage and satisfaction metrics/)).toBeInTheDocument()
  })

  it('renders Refresh button', () => {
    render(<AdminHelpAnalyticsPage />)
    expect(screen.getByRole('button', { name: /Refresh/i })).toBeInTheDocument()
  })

  it('shows loading skeletons when session exists and data not yet loaded', () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: 'mock-token' },
    })
    global.fetch = jest.fn().mockImplementation(() => new Promise(() => {})) // never resolves

    render(<AdminHelpAnalyticsPage />)

    expect(screen.getAllByTestId('help-analytics-skeleton').length).toBeGreaterThanOrEqual(1)
  })

  it('has data-testid for the analytics page container', () => {
    render(<AdminHelpAnalyticsPage />)
    expect(screen.getByTestId('admin-help-analytics-page')).toBeInTheDocument()
  })
})
