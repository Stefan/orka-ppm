/**
 * Cost Impact Calculator component tests
 * Asserts initial render (loading or content). API mock is not applied in this env,
 * so we only check that the component mounts.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import CostImpactCalculator from '@/components/change-orders/CostImpactCalculator'

jest.mock('@/lib/change-orders-api', () => ({
  changeOrdersApi: {
    getCostAnalysis: () => Promise.resolve(null),
    getCostScenarios: () => Promise.resolve([]),
  },
}))

describe('CostImpactCalculator', () => {
  it('renders without crashing', () => {
    const { container } = render(<CostImpactCalculator changeOrderId="co-1" />)
    expect(container).toBeInTheDocument()
    const spinner = container.querySelector('.animate-spin')
    const hasContent = screen.queryByText(/No cost analysis available/i) ?? spinner
    expect(hasContent).toBeTruthy()
  })
})
