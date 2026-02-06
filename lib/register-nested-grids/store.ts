/**
 * Zustand store for Register Nested Grids state
 * Requirements: 5.1, 5.5, 9.5
 */

import { create } from 'zustand'
import type { ScrollPosition, FilterState } from '@/components/register-nested-grids/types'

interface NestedGridStore {
  expandedRows: Map<string, Set<string>>
  scrollPositions: Map<string, ScrollPosition>
  filterStates: Map<string, FilterState>

  expandRow: (registerId: string, rowId: string) => void
  collapseRow: (registerId: string, rowId: string) => void
  toggleRow: (registerId: string, rowId: string) => void
  isExpanded: (registerId: string, rowId: string) => boolean

  saveScrollPosition: (registerId: string, position: ScrollPosition) => void
  restoreScrollPosition: (registerId: string) => ScrollPosition | null

  /** Hydrate expanded rows from persisted user state (e.g. on mount). Requirements: 9.2 */
  hydrateExpandedRows: (registerId: string, rowIds: string[]) => void
  /** Hydrate scroll position from persisted user state. Requirements: 9.2 */
  hydrateScrollPosition: (registerId: string, position: ScrollPosition) => void
  /** Hydrate filter state from persisted user state. Requirements: 16.5 */
  hydrateFilterState: (registerId: string, state: FilterState | null) => void

  setFilterState: (registerId: string, filters: FilterState) => void
  getFilterState: (registerId: string) => FilterState | null
}

export const useNestedGridStore = create<NestedGridStore>((set, get) => ({
  expandedRows: new Map(),
  scrollPositions: new Map(),
  filterStates: new Map(),

  expandRow: (registerId, rowId) => {
    set((state) => {
      const next = new Map(state.expandedRows)
      const setForKey = new Set(next.get(registerId) || [])
      setForKey.add(rowId)
      next.set(registerId, setForKey)
      return { expandedRows: next }
    })
  },

  collapseRow: (registerId, rowId) => {
    set((state) => {
      const next = new Map(state.expandedRows)
      const setForKey = new Set(next.get(registerId) || [])
      setForKey.delete(rowId)
      next.set(registerId, setForKey)
      return { expandedRows: next }
    })
  },

  toggleRow: (registerId, rowId) => {
    const isExp = get().isExpanded(registerId, rowId)
    if (isExp) get().collapseRow(registerId, rowId)
    else get().expandRow(registerId, rowId)
  },

  isExpanded: (registerId, rowId) => {
    return get().expandedRows.get(registerId)?.has(rowId) ?? false
  },

  saveScrollPosition: (registerId, position) => {
    set((state) => {
      const next = new Map(state.scrollPositions)
      next.set(registerId, position)
      return { scrollPositions: next }
    })
  },

  restoreScrollPosition: (registerId) => {
    return get().scrollPositions.get(registerId) ?? null
  },

  hydrateExpandedRows: (registerId, rowIds) => {
    set((state) => {
      const next = new Map(state.expandedRows)
      next.set(registerId, new Set(rowIds ?? []))
      return { expandedRows: next }
    })
  },

  hydrateScrollPosition: (registerId, position) => {
    set((state) => {
      const next = new Map(state.scrollPositions)
      next.set(registerId, position)
      return { scrollPositions: next }
    })
  },

  hydrateFilterState: (registerId, state) => {
    set((s) => {
      const next = new Map(s.filterStates)
      if (state == null) next.delete(registerId)
      else next.set(registerId, state)
      return { filterStates: next }
    })
  },

  setFilterState: (registerId, filters) => {
    set((state) => {
      const next = new Map(state.filterStates)
      next.set(registerId, filters)
      return { filterStates: next }
    })
  },

  getFilterState: (registerId) => {
    return get().filterStates.get(registerId) ?? null
  },
}))
