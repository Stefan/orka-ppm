'use client'

/**
 * Scroll Position Manager - Preserve scroll, expanded rows, and filter state on navigation.
 * Loads/saves user state to Supabase. Requirements: 5.1, 9.2, 16.5
 */

import React, { useRef, useEffect } from 'react'
import { useNestedGridStore } from '@/lib/register-nested-grids/store'
import {
  loadNestedGridUserState,
  saveNestedGridUserState,
} from '@/lib/register-nested-grids/api'
import type { ScrollPosition } from './types'

interface ScrollPositionManagerProps {
  registerId: string
  children: React.ReactNode
}

export default function ScrollPositionManager({ registerId, children }: ScrollPositionManagerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    saveScrollPosition,
    restoreScrollPosition,
    hydrateExpandedRows,
    hydrateScrollPosition,
    hydrateFilterState,
    expandedRows,
    getFilterState,
  } = useNestedGridStore()

  // Load persisted user state on mount
  useEffect(() => {
    let cancelled = false
    loadNestedGridUserState(registerId).then((state) => {
      if (cancelled || !state) return
      if (state.expandedRows.length) hydrateExpandedRows(registerId, state.expandedRows)
      if (state.scrollPosition) hydrateScrollPosition(registerId, state.scrollPosition)
      hydrateFilterState(registerId, state.filterState ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [registerId, hydrateExpandedRows, hydrateScrollPosition, hydrateFilterState])

  // Restore scroll from store (in-memory or just hydrated)
  useEffect(() => {
    const pos = restoreScrollPosition(registerId)
    if (pos && containerRef.current) {
      containerRef.current.scrollTop = pos.top
      containerRef.current.scrollLeft = pos.left
    }
  }, [registerId, restoreScrollPosition])

  // On unmount: persist to store and to Supabase (scroll, expanded rows, filter state)
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        const position: ScrollPosition = {
          top: containerRef.current.scrollTop,
          left: containerRef.current.scrollLeft,
          expandedRows: Array.from(expandedRows.get(registerId) ?? []),
        }
        saveScrollPosition(registerId, position)
        const filterState = getFilterState(registerId)
        saveNestedGridUserState(registerId, {
          expandedRows: position.expandedRows,
          scrollPosition: position,
          filterState: filterState ?? null,
        })
      }
    }
  }, [registerId, saveScrollPosition, expandedRows, getFilterState])

  return (
    <div ref={containerRef} className="overflow-auto h-full">
      {children}
    </div>
  )
}
