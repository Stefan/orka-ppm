/**
 * Feature: register-nested-grids, Property 16: Validation vor Speichern
 * Validates: Requirements 7.5
 */

import * as fc from 'fast-check'
import { validateNestedGridConfig } from '@/components/register-nested-grids/validation'

const validItemTypes = ['tasks', 'registers', 'cost_registers'] as const

const columnArb = fc.record({
  field: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  headerName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
})

const sectionArb = fc.record({
  itemType: fc.constantFrom(...validItemTypes),
  columns: fc.array(columnArb, { minLength: 1, maxLength: 20 }),
})

const validConfigArb = fc.record({
  sections: fc.array(sectionArb, { minLength: 0, maxLength: 10 }),
  enableLinkedItems: fc.boolean(),
})

describe('Feature: register-nested-grids, Property 16: Validation vor Speichern', () => {
  it('valid configs pass validation before save', () => {
    fc.assert(
      fc.property(validConfigArb, (config) => {
        const result = validateNestedGridConfig(config)
        expect(result.valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('invalid configs fail validation before save', () => {
    expect(validateNestedGridConfig({ sections: [], enableLinkedItems: true }).valid).toBe(true)
    expect(
      validateNestedGridConfig({
        sections: [{ itemType: 'tasks', columns: [] }],
        enableLinkedItems: true,
      }).valid
    ).toBe(false)
    expect(
      validateNestedGridConfig({
        sections: [{ itemType: 'invalid' as 'tasks', columns: [{ field: 'a', headerName: 'A' }] }],
        enableLinkedItems: true,
      }).valid
    ).toBe(false)
  })
})
