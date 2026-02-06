/**
 * Property 9: State Preservation Round-Trip
 * Validates: Requirements 5.1, 5.5
 * Register Nested Grids - expanded rows, scroll position, and filter state
 * must round-trip correctly (serialize/deserialize and store hydrate/read).
 */

import * as fc from 'fast-check'
import { useNestedGridStore } from '@/lib/register-nested-grids/store'
import type { ScrollPosition, FilterState, Filter, FilterOperator } from '@/components/register-nested-grids/types'

const filterOperatorArb: fc.Arbitrary<FilterOperator> = fc.constantFrom(
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'greaterThan',
  'lessThan',
  'between',
  'in',
  'notIn'
)

const filterArb: fc.Arbitrary<Filter> = fc.record({
  id: fc.uuid(),
  field: fc.string({ maxLength: 50 }),
  operator: filterOperatorArb,
  value: fc.oneof(fc.string(), fc.integer(), fc.double(), fc.boolean()),
  label: fc.string({ maxLength: 100 }),
})

const filterStateArb: fc.Arbitrary<FilterState> = fc.record({
  filters: fc.array(filterArb, { maxLength: 10 }),
  activeFilters: fc.array(fc.uuid(), { maxLength: 10 }),
})

const scrollPositionArb: fc.Arbitrary<ScrollPosition> = fc.record({
  top: fc.integer({ min: 0, max: 10000 }),
  left: fc.integer({ min: 0, max: 10000 }),
  expandedRows: fc.array(fc.uuid(), { maxLength: 50 }),
})

function filterStateEqual(a: FilterState | null, b: FilterState | null): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.activeFilters.length !== b.activeFilters.length) return false
  if (a.filters.length !== b.filters.length) return false
  const activeSetA = new Set(a.activeFilters)
  const activeSetB = new Set(b.activeFilters)
  if (activeSetA.size !== activeSetB.size) return false
  for (const id of activeSetA) if (!activeSetB.has(id)) return false
  for (let i = 0; i < a.filters.length; i++) {
    const fa = a.filters[i]
    const fb = b.filters[i]
    if (
      fa.id !== fb.id ||
      fa.field !== fb.field ||
      fa.operator !== fb.operator ||
      fa.label !== fb.label ||
      JSON.stringify(fa.value) !== JSON.stringify(fb.value)
    )
      return false
  }
  return true
}

describe('Register Nested Grids - Property 9: State Preservation Round-Trip', () => {
  beforeEach(() => {
    // Use a fresh slice of state per test by using unique registerIds
    useNestedGridStore.setState({
      expandedRows: new Map(),
      scrollPositions: new Map(),
      filterStates: new Map(),
    })
  })

  describe('JSON serialization round-trip (persistence format)', () => {
    it('ScrollPosition survives JSON round-trip', () => {
      fc.assert(
        fc.property(scrollPositionArb, (pos) => {
          const json = JSON.stringify(pos)
          const back = JSON.parse(json) as ScrollPosition
          expect(back.top).toBe(pos.top)
          expect(back.left).toBe(pos.left)
          expect(back.expandedRows).toEqual(pos.expandedRows)
        }),
        { numRuns: 100 }
      )
    })

    it('FilterState survives JSON round-trip', () => {
      fc.assert(
        fc.property(filterStateArb, (state) => {
          const json = JSON.stringify(state)
          const back = JSON.parse(json) as FilterState
          expect(back.filters.length).toBe(state.filters.length)
          expect(back.activeFilters).toEqual(state.activeFilters)
          expect(back.filters.map((f) => f.id)).toEqual(state.filters.map((f) => f.id))
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Store hydrate then read-back (in-memory round-trip)', () => {
    it('expanded rows: hydrate then read yields same set', () => {
      fc.assert(
        fc.property(fc.uuid(), fc.array(fc.uuid(), { maxLength: 30 }), (registerId, rowIds) => {
          useNestedGridStore.getState().hydrateExpandedRows(registerId, rowIds)
          const read = useNestedGridStore.getState().expandedRows.get(registerId)
          const expected = new Set(rowIds)
          // After hydrate, read back must match (empty array => empty set)
          if (rowIds.length === 0) {
            expect(read !== undefined && read.size === 0).toBe(true)
            return
          }
          expect(read).toBeDefined()
          expect(read!.size).toBe(expected.size)
          rowIds.forEach((id) => expect(read!.has(id)).toBe(true))
        }),
        { numRuns: 80 }
      )
    })

    it('scroll position: save then restore yields same position', () => {
      fc.assert(
        fc.property(fc.uuid(), scrollPositionArb, (registerId, pos) => {
          const store = useNestedGridStore.getState()
          store.hydrateScrollPosition(registerId, pos)
          const restored = store.restoreScrollPosition(registerId)
          expect(restored).not.toBeNull()
          expect(restored!.top).toBe(pos.top)
          expect(restored!.left).toBe(pos.left)
          expect(restored!.expandedRows).toEqual(pos.expandedRows)
        }),
        { numRuns: 80 }
      )
    })

    it('filter state: hydrate then get yields same state', () => {
      fc.assert(
        fc.property(fc.uuid(), filterStateArb, (registerId, state) => {
          const store = useNestedGridStore.getState()
          store.hydrateFilterState(registerId, state)
          const got = store.getFilterState(registerId)
          expect(got).not.toBeNull()
          expect(filterStateEqual(got!, state)).toBe(true)
        }),
        { numRuns: 80 }
      )
    })

    it('filter state null: hydrate null then get yields null or deleted', () => {
      const store = useNestedGridStore.getState()
      const registerId = 'filter-null-reg'
      store.hydrateFilterState(registerId, { filters: [], activeFilters: [] })
      store.hydrateFilterState(registerId, null)
      const got = store.getFilterState(registerId)
      expect(got === null || got === undefined).toBe(true)
    })
  })
})
