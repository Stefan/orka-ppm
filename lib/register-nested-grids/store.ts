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
