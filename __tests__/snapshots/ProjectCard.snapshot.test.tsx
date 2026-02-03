/**
 * Snapshot test: Dashboard ProjectCard
 * Enterprise Test Strategy - Section 8 (Phase 1)
 */

import React from 'react'
import { render } from '@testing-library/react'
import ProjectCard from '@/app/dashboards/components/ProjectCard'

const fixture = {
  id: '1',
  name: 'Office Complex Phase 1',
  status: 'active',
  health: 'green' as const,
  budget: 150000,
  created_at: '2024-01-15T10:00:00Z',
}

describe('ProjectCard snapshot', () => {
  it('matches snapshot with fixture', () => {
    const { container } = render(<ProjectCard project={fixture} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for yellow health', () => {
    const { container } = render(
      <ProjectCard
        project={{
          ...fixture,
          id: '2',
          name: 'Residential Tower A',
          health: 'yellow',
          budget: 200000,
        }}
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for red health', () => {
    const { container } = render(
      <ProjectCard
        project={{
          ...fixture,
          id: '3',
          name: 'At Risk Project',
          health: 'red',
          budget: 80000,
        }}
      />
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
