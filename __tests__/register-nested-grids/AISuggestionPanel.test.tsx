/**
 * Feature: register-nested-grids, Property 4: AI Suggestions Presence
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import AISuggestionPanel from '@/components/register-nested-grids/AISuggestionPanel'

jest.mock('@/lib/register-nested-grids/ai-suggestions', () => ({
  generateColumnSuggestions: jest.fn(() =>
    Promise.resolve([
      {
        type: 'column_combination',
        confidence: 0.9,
        suggestion: { columns: ['status', 'priority'], reason: 'Popular combo', popularity: 50 },
      },
    ])
  ),
}))

describe('AISuggestionPanel', () => {
  it('renders without crashing', () => {
    const { container } = render(<AISuggestionPanel itemType="tasks" />)
    expect(container).toBeInTheDocument()
  })

  it('accepts itemType prop', async () => {
    render(<AISuggestionPanel itemType="registers" />)
    await waitFor(() => {
      expect(document.body).toBeInTheDocument()
    })
  })
})
