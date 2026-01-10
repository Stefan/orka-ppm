'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { performanceMonitor } from '@/lib/performance'

interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number | ((index: number, item: T) => number)
  containerHeight: number
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode
  overscan?: number
  className?: string
  onScroll?: (scrollTop: number) => void
  getItemKey?: (item: T, index: number) => string | number
}

interface VirtualizedTableProps<T> {
  items: T[]
  columns: Array<{
    key: string
    header: string
    width?: number
    render?: (item: T, index: number) => React.ReactNode
  }>
  rowHeight: number
  containerHeight: number
  className?: string
  onScroll?: (scrollTop: number) => void
  getRowKey?: (item: T, index: number) => string | number
}

// Virtualized List Component
export const VirtualizedList = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  getItemKey
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const getItemHeightValue = useCallback((index: number) => {
    return typeof itemHeight === 'function' ? itemHeight(index, items[index]) : itemHeight
  }, [itemHeight, items])

  // Calculate total height and item positions
  const { totalHeight, itemPositions } = useMemo(() => {
    const positions: number[] = []
    let currentPosition = 0
    
    for (let i = 0; i < items.length; i++) {
      positions[i] = currentPosition
      currentPosition += getItemHeightValue(i)
    }
    
    return {
      totalHeight: currentPosition,
      itemPositions: positions
    }
  }, [items.length, getItemHeightValue])

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, 
      itemPositions.findIndex(pos => pos + getItemHeightValue(itemPositions.indexOf(pos)) > scrollTop) - overscan
    )
    
    let endIndex = startIndex
    let currentHeight = itemPositions[startIndex] || 0
    
    while (endIndex < items.length && currentHeight < scrollTop + containerHeight + overscan * getItemHeightValue(endIndex)) {
      currentHeight += getItemHeightValue(endIndex)
      endIndex++
    }
    
    return {
      start: Math.max(0, startIndex),
      end: Math.min(items.length - 1, endIndex + overscan)
    }
  }, [scrollTop, containerHeight, itemPositions, items.length, overscan, getItemHeightValue])

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = event.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    onScroll?.(newScrollTop)
    
    // Record scroll performance
    performanceMonitor.recordMetric('virtualized_list_scroll', performance.now(), 'custom', {
      itemCount: items.length,
      visibleItems: visibleRange.end - visibleRange.start + 1
    })
  }, [onScroll, items.length, visibleRange])

  // Render visible items
  const visibleItems = useMemo(() => {
    const rendered = []
    
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      if (i >= items.length) break
      
      const item = items[i]
      const top = itemPositions[i] || 0
      const height = getItemHeightValue(i)
      
      const style: React.CSSProperties = {
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height
      }
      
      const key = getItemKey ? getItemKey(item, i) : i
      
      rendered.push(
        <div key={key} style={style}>
          {renderItem(item, i, style)}
        </div>
      )
    }
    
    return rendered
  }, [visibleRange, items, itemPositions, getItemHeightValue, renderItem, getItemKey])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        ref={scrollElementRef}
        style={{ height: totalHeight, position: 'relative' }}
      >
        {visibleItems}
      </div>
    </div>
  )
}

// Virtualized Table Component
export const VirtualizedTable = <T,>({
  items,
  columns,
  rowHeight,
  containerHeight,
  className = '',
  onScroll,
  getRowKey
}: VirtualizedTableProps<T>) => {
  const renderRow = useCallback((item: T, index: number, style: React.CSSProperties) => {
    return (
      <div className="flex border-b border-gray-200" style={style}>
        {columns.map((column, colIndex) => (
          <div
            key={column.key}
            className="px-4 py-2 flex-shrink-0 overflow-hidden"
            style={{ width: column.width || `${100 / columns.length}%` }}
          >
            {column.render ? column.render(item, index) : (item as any)[column.key]}
          </div>
        ))}
      </div>
    )
  }, [columns])

  return (
    <div className={`border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex bg-gray-50 border-b border-gray-200">
        {columns.map((column) => (
          <div
            key={column.key}
            className="px-4 py-3 font-medium text-gray-900 flex-shrink-0"
            style={{ width: column.width || `${100 / columns.length}%` }}
          >
            {column.header}
          </div>
        ))}
      </div>
      
      {/* Virtualized Rows */}
      <VirtualizedList
        items={items}
        itemHeight={rowHeight}
        containerHeight={containerHeight - 48} // Subtract header height
        renderItem={renderRow}
        getItemKey={getRowKey}
        onScroll={onScroll}
      />
    </div>
  )
}

// Virtualized Grid Component
export const VirtualizedGrid = <T,>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  className = '',
  gap = 0
}: {
  items: T[]
  itemWidth: number
  itemHeight: number
  containerWidth: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  gap?: number
}) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const columnsPerRow = Math.floor((containerWidth + gap) / (itemWidth + gap))
  const totalRows = Math.ceil(items.length / columnsPerRow)
  const totalHeight = totalRows * (itemHeight + gap) - gap

  const visibleRowStart = Math.floor(scrollTop / (itemHeight + gap))
  const visibleRowEnd = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + containerHeight) / (itemHeight + gap))
  )

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
    setScrollLeft(event.currentTarget.scrollLeft)
  }, [])

  const visibleItems = useMemo(() => {
    const rendered = []
    
    for (let row = visibleRowStart; row <= visibleRowEnd; row++) {
      for (let col = 0; col < columnsPerRow; col++) {
        const index = row * columnsPerRow + col
        if (index >= items.length) break
        
        const item = items[index]
        const x = col * (itemWidth + gap)
        const y = row * (itemHeight + gap)
        
        rendered.push(
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: itemWidth,
              height: itemHeight
            }}
          >
            {renderItem(item, index)}
          </div>
        )
      }
    }
    
    return rendered
  }, [visibleRowStart, visibleRowEnd, columnsPerRow, items, itemWidth, itemHeight, gap, renderItem])

  return (
    <div
      className={`relative overflow-auto ${className}`}
      style={{ width: containerWidth, height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ width: '100%', height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  )
}

// Hook for virtualized scrolling
export const useVirtualizedScrolling = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(itemCount - 1, start + visibleCount + overscan * 2)
    
    return { start, end, visibleCount }
  }, [scrollTop, itemHeight, containerHeight, itemCount, overscan])

  const totalHeight = itemCount * itemHeight

  return {
    scrollTop,
    setScrollTop,
    visibleRange,
    totalHeight
  }
}

export default VirtualizedList