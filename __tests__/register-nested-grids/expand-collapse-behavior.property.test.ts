/**
 * Property 6: Nested Grid Expand/Collapse Behavior
 * Validates: Requirements 4.1, 4.2, 4.6
 */

import * as fc from 'fast-check'
import { useNestedGridStore } from '@/lib/register-nested-grids/store'

describe('Register Nested Grids - Property 8.2: Expand/Collapse Behavior', () => {
  beforeEach(() => {
    useNestedGridStore.setState({
      expandedRows: new Map(),
    })
  })

  it('after expandRow(registerId, rowId), isExpanded returns true', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (registerId, rowId) => {
        useNestedGridStore.getState().expandRow(registerId, rowId)
        expect(useNestedGridStore.getState().isExpanded(registerId, rowId)).toBe(true)
      }),
      { numRuns: 50 }
    )
  })

  it('after collapseRow(registerId, rowId), isExpanded returns false', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (registerId, rowId) => {
        const store = useNestedGridStore.getState()
        store.expandRow(registerId, rowId)
        store.collapseRow(registerId, rowId)
        expect(store.isExpanded(registerId, rowId)).toBe(false)
      }),
      { numRuns: 50 }
    )
  })

  it('toggleRow flips expanded state', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (registerId, rowId) => {
        const store = useNestedGridStore.getState()
        const before = store.isExpanded(registerId, rowId)
        store.toggleRow(registerId, rowId)
        expect(store.isExpanded(registerId, rowId)).toBe(!before)
        store.toggleRow(registerId, rowId)
        expect(store.isExpanded(registerId, rowId)).toBe(before)
      }),
      { numRuns: 50 }
    )
  })

  it('multiple rows can be expanded independently', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        (registerId, rowIds) => {
          const store = useNestedGridStore.getState()
          rowIds.forEach((id) => store.expandRow(registerId, id))
          rowIds.forEach((id) => expect(store.isExpanded(registerId, id)).toBe(true))
          store.collapseRow(registerId, rowIds[0])
          expect(store.isExpanded(registerId, rowIds[0])).toBe(false)
          rowIds.slice(1).forEach((id) => expect(store.isExpanded(registerId, id)).toBe(true))
        }
      ),
      { numRuns: 30 }
    )
  })
})
