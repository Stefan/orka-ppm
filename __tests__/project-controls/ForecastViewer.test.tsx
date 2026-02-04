/**
 * Forecast Viewer component tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import ForecastViewer from '@/components/project-controls/ForecastViewer'

jest.mock('@/lib/project-controls-api', () => ({
  projectControlsApi: {
    getMonthlyForecast: jest.fn().mockResolvedValue([]),
  },
}))

describe('ForecastViewer', () => {
  it('renders without crashing', () => {
    const { container } = render(<ForecastViewer projectId="proj-1" />)
    expect(container).toBeInTheDocument()
  })
})
