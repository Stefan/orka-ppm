'use client'

/**
 * Phase 1 – Security & Scalability: Infinite scrolling table for large datasets
 * Enterprise Readiness: Pagination + Infinite Scrolling (react-query style API)
 */

import React, { useCallback, useEffect, useRef } from 'react'

export interface InfiniteScrollTableProps<T> {
  items: T[]
  loading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  renderRow: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
  /** Optional: root margin for IntersectionObserver (default 200px) */
  rootMargin?: string
  /** Optional: table header */
  header?: React.ReactNode
  /** Optional: empty state */
  emptyMessage?: string
  /** Optional: loading row at bottom */
  loadingRow?: React.ReactNode
  className?: string
}

export function InfiniteScrollTable<T>({
  items,
  loading,
  hasMore,
  onLoadMore,
  renderRow,
  keyExtractor,
  rootMargin = '200px',
  header,
  emptyMessage = 'Keine Einträge',
  loadingRow,
  className = '',
}: InfiniteScrollTableProps<T>) {
  const sentinelRef = useRef<HTMLTableRowElement | null>(null)

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (!entry?.isIntersecting || !hasMore || loading || !onLoadMore) return
      onLoadMore()
    },
    [hasMore, loading, onLoadMore]
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !onLoadMore) return
    const observer = new IntersectionObserver(handleIntersect, { rootMargin, threshold: 0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [handleIntersect, onLoadMore, rootMargin])

  return (
    <div className={`overflow-auto ${className}`}>
      <table className="min-w-full divide-y divide-gray-200">
        {header && <thead className="bg-gray-50">{header}</thead>}
        <tbody className="bg-white divide-y divide-gray-200">
          {items.length === 0 && !loading && (
            <tr>
              <td colSpan={100} className="px-4 py-8 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          )}
          {items.map((item, index) => (
            <tr key={keyExtractor(item)}>{renderRow(item, index)}</tr>
          ))}
          {hasMore && (
            <tr ref={sentinelRef}>
              <td colSpan={100} className="p-2" />
            </tr>
          )}
          {loading && loadingRow && (
            <tr>
              <td colSpan={100}>{loadingRow}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default InfiniteScrollTable
