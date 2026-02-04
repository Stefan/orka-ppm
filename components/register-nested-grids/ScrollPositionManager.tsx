'use client'

/**
 * Scroll Position Manager - Preserve scroll on navigation
 * Requirements: 5.1
 */

import React, { useRef, useEffect } from 'react'
import { useNestedGridStore } from '@/lib/register-nested-grids/store'
import type { ScrollPosition } from './types'

interface ScrollPositionManagerProps {
  registerId: string
  children: React.ReactNode
}

export default function ScrollPositionManager({ registerId, children }: ScrollPositionManagerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { saveScrollPosition, restoreScrollPosition, expandedRows } = useNestedGridStore()

  useEffect(() => {
    const pos = restoreScrollPosition(registerId)
    if (pos && containerRef.current) {
      containerRef.current.scrollTop = pos.top
      containerRef.current.scrollLeft = pos.left
    }
  }, [registerId, restoreScrollPosition])

  useEffect(() => {
    return () => {
      if (containerRef.current) {
        saveScrollPosition(registerId, {
          top: containerRef.current.scrollTop,
          left: containerRef.current.scrollLeft,
          expandedRows: Array.from(expandedRows.get(registerId) ?? []),
        })
      }
    }
  }, [registerId, saveScrollPosition, expandedRows])

  return (
    <div ref={containerRef} className="overflow-auto h-full">
      {children}
    </div>
  )
}
