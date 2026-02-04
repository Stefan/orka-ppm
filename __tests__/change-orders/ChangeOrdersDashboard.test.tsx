/**
 * Change Orders Dashboard component tests
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangeOrdersDashboard from '@/components/change-orders/ChangeOrdersDashboard'

jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({ user: { id: 'test-user-1' } }),
}))

jest.mock('@/lib/change-orders-api', () => ({
  changeOrdersApi: {
    list: jest.fn().mockResolvedValue([]),
    getDashboard: jest.fn().mockResolvedValue({
      summary: {
        total_change_orders: 0,
        approved_change_orders: 0,
        rejected_change_orders: 0,
        total_cost_impact: 0,
      },
      recent_change_orders: [],
      pending_approvals: [],
      cost_impact_summary: {},
    }),
  },
}))

jest.mock('@/components/shared/AppLayout', () => ({ children }: { children: React.ReactNode }) => (
  <div data-testid="app-layout">{children}</div>
))

jest.mock('@/components/ui/molecules/ResponsiveContainer', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}))

describe('ChangeOrdersDashboard', () => {
  const projectId = 'test-project-123'
  const projectName = 'Test Project'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders dashboard title and project name', async () => {
    render(<ChangeOrdersDashboard projectId={projectId} projectName={projectName} />)

    await waitFor(
      () => {
        expect(screen.getAllByText(/Change Orders/).length).toBeGreaterThan(0)
        expect(screen.getByText(/Test Project/)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('shows New Change Order button', async () => {
    render(<ChangeOrdersDashboard projectId={projectId} projectName={projectName} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Change Order/i })).toBeInTheDocument()
    })
  })

  it('calls changeOrdersApi.list with projectId', async () => {
    const { changeOrdersApi } = await import('@/lib/change-orders-api')
    render(<ChangeOrdersDashboard projectId={projectId} projectName={projectName} />)

    await waitFor(() => {
      expect(changeOrdersApi.list).toHaveBeenCalledWith(projectId, undefined)
    })
  })

  it('displays filter controls', async () => {
    render(<ChangeOrdersDashboard projectId={projectId} projectName={projectName} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search by title or number/)).toBeInTheDocument()
      expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument()
    })
  })

  it('opens wizard when New Change Order is clicked', async () => {
    const user = userEvent.setup()
    render(<ChangeOrdersDashboard projectId={projectId} projectName={projectName} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /New Change Order/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /New Change Order/i }))

    await waitFor(() => {
      expect(screen.getByText('Create Change Order')).toBeInTheDocument()
      expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument()
    })
  })
})
