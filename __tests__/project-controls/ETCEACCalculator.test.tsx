/**
 * ETC/EAC Calculator component tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import ETCEACCalculator from '@/components/project-controls/ETCEACCalculator'

jest.mock('@/lib/project-controls-api', () => ({
  projectControlsApi: {
    getETC: jest.fn().mockResolvedValue({ result_value: 50000, confidence_level: 0.8 }),
    getEAC: jest.fn().mockResolvedValue({ result_value: 120000, confidence_level: 0.85 }),
  },
}))

describe('ETCEACCalculator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<ETCEACCalculator projectId="proj-1" />)
    expect(container).toBeInTheDocument()
  })

  it('shows ETC and EAC method selectors', () => {
    render(<ETCEACCalculator projectId="proj-1" />)
    expect(screen.getByText(/ETC Method/)).toBeInTheDocument()
    expect(screen.getByText(/EAC Method/)).toBeInTheDocument()
  })
})
