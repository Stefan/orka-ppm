/**
 * Component tests for Admin Hierarchy page (Portfolio → Program → Project).
 * Spec: .kiro/specs/entity-hierarchy/ Target: 80% coverage.
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

jest.mock('@/components/shared/AppLayout', () => ({ children }: { children: React.ReactNode }) => (
  <div data-testid="app-layout">{children}</div>
))

const mockSession = { access_token: 'test-token' }
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({ session: mockSession, loading: false }),
}))

import AdminHierarchyPage from '@/app/admin/hierarchy/page'

describe('Admin Hierarchy page', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = jest.fn((url: string | URL) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('/api/portfolios')) return Promise.resolve({ ok: true, json: async () => [] } as Response)
      if (u.includes('/api/programs')) return Promise.resolve({ ok: true, json: async () => [] } as Response)
      if (u.includes('/api/projects')) return Promise.resolve({ ok: true, json: async () => ({ items: [] }) } as Response)
      return Promise.reject(new Error('Unknown URL'))
    }) as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('renders heading and Tree section', async () => {
    render(<AdminHierarchyPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /hierarchy/i })).toBeInTheDocument()
    })
    expect(screen.getByText('Tree')).toBeInTheDocument()
  })

  it('shows New Portfolio, Program, Project buttons', async () => {
    render(<AdminHierarchyPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /portfolio/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /program/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /project/i })).toBeInTheDocument()
  })

  it('shows Detail section with empty state when nothing selected', async () => {
    render(<AdminHierarchyPage />)
    await waitFor(() => {
      expect(screen.getByText('Select a node in the tree.')).toBeInTheDocument()
    })
    expect(screen.getByText('Detail')).toBeInTheDocument()
  })

  it('opens New Program modal when Program button clicked', async () => {
    const user = userEvent.setup()
    render(<AdminHierarchyPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /program/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /program/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /new program/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('opens New Portfolio modal when Portfolio button clicked', async () => {
    const user = userEvent.setup()
    render(<AdminHierarchyPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /portfolio/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /portfolio/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /new portfolio/i })).toBeInTheDocument()
    })
  })

  it('opens New Project modal when Project button clicked', async () => {
    const user = userEvent.setup()
    render(<AdminHierarchyPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /project/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /project/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /new project/i })).toBeInTheDocument()
    })
  })

  it('closes New Program modal on Cancel', async () => {
    const user = userEvent.setup()
    render(<AdminHierarchyPage />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /program/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /program/i }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /new program/i })).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /new program/i })).not.toBeInTheDocument()
    })
  })
})
