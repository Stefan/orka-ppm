/**
 * Cost Impact Calculator component tests
 */

import React from 'react'
import { render } from '@testing-library/react'
import CostImpactCalculator from '@/components/change-orders/CostImpactCalculator'

jest.mock('@/lib/change-orders-api', () => ({
  changeOrdersApi: {
    getCostAnalysis: jest.fn().mockResolvedValue(null),
    getCostScenarios: jest.fn().mockResolvedValue([]),
  },
}))

describe('CostImpactCalculator', () => {
  it('renders without crashing', () => {
    const { container } = render(<CostImpactCalculator changeOrderId="co-1" />)
    expect(container).toBeInTheDocument()
  })
})
