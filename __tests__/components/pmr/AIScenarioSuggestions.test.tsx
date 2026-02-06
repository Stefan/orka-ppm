/**
 * Unit tests for AIScenarioSuggestions
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIScenarioSuggestions } from '@/components/pmr/AIScenarioSuggestions'

const mockSuggestions = {
  suggestions: [
    {
      id: 'preset-optimistic',
      name: 'Optimistic',
      description: 'Lower uncertainty',
      params: {
        budget_uncertainty: 0.1,
        schedule_uncertainty: 0.15,
        iterations: 5000,
      },
    },
  ],
}

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation((() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockSuggestions),
    } as Response)) as typeof fetch)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('AIScenarioSuggestions', () => {
  it('renders trigger button', () => {
    render(
      <AIScenarioSuggestions
        projectId="p1"
        onApply={jest.fn()}
        onApplyAndRun={jest.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /AI-Szenarien|vorschlagen/i })).toBeInTheDocument()
  })

  it('calls fetch with project-scoped URL on button click', async () => {
    const onApply = jest.fn()
    render(
      <AIScenarioSuggestions
        projectId="proj-123"
        onApply={onApply}
        onApplyAndRun={jest.fn()}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /AI-Szenarien vorschlagen/i }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/projects/proj-123/simulations/ai-suggestions')
      )
    })
  })

})
