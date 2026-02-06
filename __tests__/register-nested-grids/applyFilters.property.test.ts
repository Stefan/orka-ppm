/**
 * Feature: register-nested-grids, Property 21: Filter Application Logic
 * Validates: Requirements 9.2, 9.3
 */

import fc from 'fast-check'
import { applyFilters } from '@/components/register-nested-grids/applyFilters'
import type { Filter } from '@/components/register-nested-grids/types'

describe('Property 21: Filter Application Logic', () => {
  it('empty filters returns all items', () => {
    fc.assert(
      fc.property(fc.array(fc.record({ id: fc.string(), name: fc.string() })), (data) => {
        const result = applyFilters(data, [])
        expect(result).toEqual(data)
      }),
      { numRuns: 100 }
    )
  })

  it('equals filter returns matching items', () => {
    const data = [
      { id: '1', status: 'open' },
      { id: '2', status: 'closed' },
      { id: '3', status: 'open' },
    ]
    const filters: Filter[] = [{ id: 'f1', field: 'status', operator: 'equals', value: 'open', label: 'Status' }]
    const result = applyFilters(data, filters)
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.status === 'open')).toBe(true)
  })

  it('AND logic: multiple filters', () => {
    const data = [
      { id: '1', a: 1, b: 2 },
      { id: '2', a: 1, b: 3 },
      { id: '3', a: 2, b: 2 },
    ]
    const filters: Filter[] = [
      { id: 'f1', field: 'a', operator: 'equals' as const, value: 1, label: 'A' },
      { id: 'f2', field: 'b', operator: 'equals' as const, value: 2, label: 'B' },
    ]
    const result = applyFilters(data, filters)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ id: '1', a: 1, b: 2 })
  })

  it('Property 22: Filter Removal Round-Trip – removing a filter widens result', () => {
    const data = [
      { id: '1', a: 1, b: 2 },
      { id: '2', a: 1, b: 3 },
      { id: '3', a: 2, b: 2 },
    ]
    const filtersBoth: Filter[] = [
      { id: 'f1', field: 'a', operator: 'equals' as const, value: 1, label: 'A' },
      { id: 'f2', field: 'b', operator: 'equals' as const, value: 2, label: 'B' },
    ]
    const filtersOne: Filter[] = [
      { id: 'f1', field: 'a', operator: 'equals' as const, value: 1, label: 'A' },
    ]
    const withBoth = applyFilters(data, filtersBoth)
    const withOne = applyFilters(data, filtersOne)
    expect(withBoth.length).toBeLessThanOrEqual(withOne.length)
    withBoth.forEach((row) => {
      expect(withOne.some((r) => (r as { id: string }).id === (row as { id: string }).id)).toBe(true)
    })
  })
})
