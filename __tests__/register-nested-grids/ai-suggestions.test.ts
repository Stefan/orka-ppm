/**
 * Feature: register-nested-grids, Property 24: AI Filter Suggestions
 * Validates: Requirements 9.6
 */

import { suggestFilters, generateColumnSuggestions } from '@/lib/register-nested-grids/ai-suggestions'

jest.mock('@/lib/api/supabase-minimal', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { user: {} } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({ limit: () => Promise.resolve({ data: null }) }),
          }),
        }),
      }),
    }),
  },
}))

describe('Feature: register-nested-grids, Property 4 & 24: AI Suggestions', () => {
  it('Property 24: suggestFilters returns array of filter suggestions', async () => {
    const result = await suggestFilters('tasks')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(0)
    result.forEach((s) => {
      expect(s).toHaveProperty('field')
      expect(s).toHaveProperty('operator')
      expect(s).toHaveProperty('reason')
    })
  })

  it('Property 4: generateColumnSuggestions returns array', async () => {
    const result = await generateColumnSuggestions('tasks')
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })
})
