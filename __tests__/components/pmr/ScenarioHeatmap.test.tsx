/**
 * Unit tests for ScenarioHeatmap
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScenarioHeatmap } from '@/components/pmr/ScenarioHeatmap'

const scenariosWithResults = [
  {
    id: 's1',
    name: 'Baseline',
    results: {
      results: {
        budget_analysis: {
          percentiles: { p50: 1000, p90: 1200 },
          expected_final_cost: 1100,
        },
        schedule_analysis: {
          percentiles: { p50: 100 },
          expected_final_duration: 100,
        },
      },
    },
  },
  {
    id: 's2',
    name: 'Optimistic',
    results: {
      results: {
        budget_analysis: {
          percentiles: { p50: 900, p90: 1100 },
          expected_final_cost: 950,
        },
        schedule_analysis: {
          percentiles: { p50: 90 },
          expected_final_duration: 90,
        },
      },
    },
  },
]

describe('ScenarioHeatmap', () => {
  it('renders nothing when no scenarios', () => {
    const { container } = render(
      <ScenarioHeatmap scenarios={[]} onApplyScenario={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders table with scenario names and Apply button', () => {
    const onApply = jest.fn()
    render(
      <ScenarioHeatmap
        scenarios={scenariosWithResults}
        onApplyScenario={onApply}
      />
    )
    expect(screen.getByText('Baseline')).toBeInTheDocument()
    expect(screen.getByText('Optimistic')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: /apply/i })
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(buttons[0])
    expect(onApply).toHaveBeenCalledWith('s1')
  })

  it('shows CO2 column when showCO2 is true', () => {
    render(
      <ScenarioHeatmap
        scenarios={scenariosWithResults}
        onApplyScenario={jest.fn()}
        showCO2
      />
    )
    expect(screen.getAllByText(/tCO2e/).length).toBeGreaterThan(0)
  })
})
