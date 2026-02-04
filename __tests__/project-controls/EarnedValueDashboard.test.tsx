/**
 * Earned Value Dashboard component tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import EarnedValueDashboard from '@/components/project-controls/EarnedValueDashboard'

jest.mock('@/lib/project-controls-api', () => ({
  projectControlsApi: {
    getEarnedValueMetrics: jest.fn().mockResolvedValue(null),
  },
}))

describe('EarnedValueDashboard', () => {
  it('renders without crashing', () => {
    const { container } = render(<EarnedValueDashboard projectId="proj-1" />)
    expect(container).toBeInTheDocument()
  })
})
