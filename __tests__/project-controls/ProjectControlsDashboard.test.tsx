/**
 * Project Controls Dashboard component tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import ProjectControlsDashboard from '@/components/project-controls/ProjectControlsDashboard'

jest.mock('@/lib/project-controls-api', () => ({
  projectControlsApi: {},
}))

describe('ProjectControlsDashboard', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProjectControlsDashboard projectId="proj-1" />)
    expect(container).toBeInTheDocument()
  })

  it('shows tab buttons', () => {
    render(<ProjectControlsDashboard projectId="proj-1" />)
    expect(screen.getByText(/ETC\/EAC/)).toBeInTheDocument()
    expect(screen.getByText(/forecast/)).toBeInTheDocument()
  })
})
