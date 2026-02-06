/**
 * Unit tests for EnhancedAuthProvider (mocked useAuth + supabase).
 * @regression Critical path: Auth context for session and permissions.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockUseAuth = jest.fn()
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockSupabaseFrom = jest.fn()
const mockChannelOn = jest.fn().mockReturnValue({ subscribe: jest.fn() })
const mockChannel = jest.fn().mockReturnValue({ on: mockChannelOn })
jest.mock('@/lib/api/supabase-minimal', () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: jest.fn(),
  },
}))

// Import after mocks
import { EnhancedAuthProvider } from '../EnhancedAuthProvider'

describe('EnhancedAuthProvider [@regression]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    }
    mockSupabaseFrom.mockReturnValue(chain)
  })

  it('[@regression] renders children when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: true,
      error: null,
    })
    render(
      <EnhancedAuthProvider>
        <div>Child</div>
      </EnhancedAuthProvider>
    )
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('[@regression] renders children when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      error: null,
    })
    render(
      <EnhancedAuthProvider>
        <div>Child</div>
      </EnhancedAuthProvider>
    )
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('[@regression] renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      session: { access_token: 'token', user: { id: 'user-1' } },
      user: { id: 'user-1' },
      loading: false,
      error: null,
    })
    render(
      <EnhancedAuthProvider>
        <div>Child</div>
      </EnhancedAuthProvider>
    )
    expect(screen.getByText('Child')).toBeInTheDocument()
  })
})
