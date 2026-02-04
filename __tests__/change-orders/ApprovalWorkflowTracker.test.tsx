/**
 * Approval Workflow Tracker component tests
 */

import React from 'react'
import { render, waitFor } from '@testing-library/react'
import ApprovalWorkflowTracker from '@/components/change-orders/ApprovalWorkflowTracker'

jest.mock('@/lib/change-orders-api', () => ({
  changeOrdersApi: {
    getWorkflowStatus: jest.fn().mockResolvedValue(null),
    getPendingApprovals: jest.fn().mockResolvedValue([]),
  },
}))

describe('ApprovalWorkflowTracker', () => {
  it('renders without crashing', async () => {
    const { container } = render(
      <ApprovalWorkflowTracker changeOrderId="co-1" currentUserId="user-1" />
    )
    await waitFor(() => {
      expect(container.querySelector('.animate-spin') || container.textContent).toBeTruthy()
    })
  })
})
