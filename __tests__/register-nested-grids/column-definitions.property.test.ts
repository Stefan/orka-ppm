/**
 * Feature: register-nested-grids
 * Property 5: Dynamic Column Selection basierend auf Item Type
 * Property 3: Minimum Column Availability
 * Validates: Requirements 2.4, 3.4
 */

import * as fc from 'fast-check'
import { COLUMN_DEFINITIONS } from '@/components/register-nested-grids/COLUMN_DEFINITIONS'
import type { ItemType } from '@/components/register-nested-grids/types'

const itemTypes: ItemType[] = ['tasks', 'registers', 'cost_registers']

describe('Feature: register-nested-grids, Property 3: Minimum Column Availability', () => {
  it('each item type has at least 10 columns', () => {
    fc.assert(
      fc.property(fc.constantFrom(...itemTypes), (itemType) => {
        const cols = COLUMN_DEFINITIONS[itemType]
        expect(Array.isArray(cols)).toBe(true)
        expect(cols.length).toBeGreaterThanOrEqual(10)
      }),
      { numRuns: 20 }
    )
  })
})

describe('Feature: register-nested-grids, Property 5: Dynamic Column Selection basierend auf Item Type', () => {
  it('column sets differ by item type', () => {
    const tasksFields = COLUMN_DEFINITIONS.tasks.map((c) => c.field)
    const registersFields = COLUMN_DEFINITIONS.registers.map((c) => c.field)
    const costFields = COLUMN_DEFINITIONS.cost_registers.map((c) => c.field)
    expect(tasksFields).not.toEqual(registersFields)
    expect(registersFields).not.toEqual(costFields)
    expect(tasksFields).not.toEqual(costFields)
  })

  it('selecting by item type returns only that type columns', () => {
    fc.assert(
      fc.property(fc.constantFrom(...itemTypes), (itemType) => {
        const cols = COLUMN_DEFINITIONS[itemType]
        expect(cols.every((c) => c.field && c.headerName)).toBe(true)
        expect(cols.length).toBeGreaterThanOrEqual(10)
      }),
      { numRuns: 20 }
    )
  })
})
