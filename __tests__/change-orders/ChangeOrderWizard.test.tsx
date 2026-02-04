/**
 * Change Order Wizard component tests
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChangeOrderWizard from '@/components/change-orders/ChangeOrderWizard'

jest.mock('@/lib/change-orders-api', () => ({
  changeOrdersApi: {
    create: jest.fn().mockResolvedValue({ id: 'co-1', change_order_number: 'CO-001', title: 'Test' }),
  },
}))

describe('ChangeOrderWizard', () => {
  const onComplete = jest.fn()
  const onCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders wizard with step 1', () => {
    render(
      <ChangeOrderWizard projectId="proj-1" onComplete={onComplete} onCancel={onCancel} />
    )
    expect(screen.getByText('Create Change Order')).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Change order title/)).toBeInTheDocument()
  })

  it('shows Next button disabled until required fields filled', async () => {
    render(
      <ChangeOrderWizard projectId="proj-1" onComplete={onComplete} onCancel={onCancel} />
    )
    const nextBtn = screen.getByRole('button', { name: /Next/ })
    expect(nextBtn).toBeDisabled()
  })

  it('calls onCancel when Cancel clicked', async () => {
    const user = userEvent.setup()
    render(
      <ChangeOrderWizard projectId="proj-1" onComplete={onComplete} onCancel={onCancel} />
    )
    await user.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(onCancel).toHaveBeenCalled()
  })
})
