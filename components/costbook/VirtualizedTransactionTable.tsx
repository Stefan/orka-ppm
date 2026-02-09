'use client'

import React, { useMemo, useCallback } from 'react'
import { useTranslations } from '@/lib/i18n/context'
import { FixedSizeList as List, ListChildComponentProps } from 'react-window'
import { ArrowUpDown, ArrowUp, ArrowDown, FileText, Receipt, Calendar, Building2, DollarSign } from 'lucide-react'
import { Transaction, Currency, POStatus, ActualStatus, CURRENCY_SYMBOLS } from '@/types/costbook'
import { TransactionSortField, SortDirection } from '@/lib/costbook/transaction-queries'
import { formatCurrency } from '@/lib/currency-utils'

export interface TransactionColumn {
  id: string
  label: string
  width: number
  sortable: boolean
  render?: (transaction: Transaction, currency: Currency) => React.ReactNode
}

export interface VirtualizedTransactionTableProps {
  /** Array of transactions to display */
  transactions: Transaction[]
  /** Currency for formatting amounts */
  currency: Currency
  /** Visible column IDs */
  visibleColumns?: string[]
  /** Current sort field */
  sortColumn?: TransactionSortField
  /** Current sort direction */
  sortDirection?: SortDirection
  /** Handler for sort changes */
  onSortChange?: (field: TransactionSortField, direction: SortDirection) => void
  /** Handler for row click */
  onRowClick?: (transaction: Transaction) => void
  /** Row height in pixels */
  rowHeight?: number
  /** Table height in pixels */
  height?: number
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

// Default columns configuration
const DEFAULT_COLUMNS: TransactionColumn[] = [
  {
    id: 'type',
    label: 'Type',
    width: 100,
    sortable: true,
    render: (t) => (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        t.type === 'commitment' 
          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      }`}>
        {t.type === 'commitment' ? <FileText className="w-3 h-3" /> : <Receipt className="w-3 h-3" />}
        {t.type === 'commitment' ? 'Commitment' : 'Actual'}
      </span>
    )
  },
  {
    id: 'date',
    label: 'Date',
    width: 110,
    sortable: true,
    render: (t) => (
      <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
        <Calendar className="w-3 h-3" />
        {new Date(t.date).toLocaleDateString()}
      </span>
    )
  },
  {
    id: 'vendor_name',
    label: 'Vendor',
    width: 180,
    sortable: true,
    render: (t) => (
      <span className="flex items-center gap-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
        <Building2 className="w-3 h-3 flex-shrink-0" />
        {t.vendor_name}
      </span>
    )
  },
  {
    id: 'description',
    label: 'Description',
    width: 250,
    sortable: false,
    render: (t) => (
      <span className="text-sm text-gray-600 dark:text-gray-400 truncate" title={t.description}>
        {t.description}
      </span>
    )
  },
  {
    id: 'po_number',
    label: 'PO #',
    width: 120,
    sortable: false,
    render: (t) => (
      <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
        {t.po_number || '-'}
      </span>
    )
  },
  {
    id: 'amount',
    label: 'Amount',
    width: 130,
    sortable: true,
    render: (t, currency) => (
      <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <DollarSign className="w-3 h-3" />
        {formatCurrency(t.amount, currency)}
      </span>
    )
  },
  {
    id: 'status',
    label: 'Status',
    width: 100,
    sortable: true,
    render: (t) => {
      const statusColors: Record<string, string> = {
        [POStatus.DRAFT]: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        [POStatus.APPROVED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        [POStatus.ISSUED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        [POStatus.RECEIVED]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
        [POStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        [ActualStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
        [ActualStatus.APPROVED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        [ActualStatus.REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        [ActualStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      }
      const colorClass = statusColors[t.status] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
      return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass}`}>
          {t.status}
        </span>
      )
    }
  }
]

/**
 * VirtualizedTransactionTable component for efficient rendering of large transaction lists
 * Uses react-window for virtualization with fixed 48px row height
 */
export function VirtualizedTransactionTable({
  transactions,
  currency,
  visibleColumns,
  sortColumn = 'date',
  sortDirection = 'desc',
  onSortChange,
  onRowClick,
  rowHeight = 48,
  height = 400,
  className = '',
  'data-testid': testId = 'virtualized-transaction-table'
}: VirtualizedTransactionTableProps) {
  const { t } = useTranslations()
  // Filter columns based on visibility
  const columns = useMemo(() => {
    if (!visibleColumns || visibleColumns.length === 0) {
      return DEFAULT_COLUMNS
    }
    return DEFAULT_COLUMNS.filter(col => visibleColumns.includes(col.id))
  }, [visibleColumns])

  // Calculate total width
  const totalWidth = useMemo(() => 
    columns.reduce((sum, col) => sum + col.width, 0),
    [columns]
  )

  // Handle sort click
  const handleSortClick = useCallback((columnId: string) => {
    if (!onSortChange) return
    
    const column = columns.find(c => c.id === columnId)
    if (!column?.sortable) return

    const field = columnId as TransactionSortField
    const newDirection: SortDirection = 
      sortColumn === field && sortDirection === 'asc' ? 'desc' : 'asc'
    
    onSortChange(field, newDirection)
  }, [columns, sortColumn, sortDirection, onSortChange])

  // Get sort icon
  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="w-3 h-3 text-gray-400 dark:text-slate-500" />
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-blue-500 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-500 dark:text-blue-400" />
  }

  // Row renderer for react-window
  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const transaction = transactions[index]
    
    return (
      <div
        style={style}
        className={`flex items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-gray-800/50 transition-colors ${
          onRowClick ? 'cursor-pointer' : ''
        }`}
        onClick={() => onRowClick?.(transaction)}
        data-testid={`transaction-row-${index}`}
      >
        {columns.map(column => (
          <div
            key={column.id}
            style={{ width: column.width }}
            className="px-3 py-2 flex items-center overflow-hidden"
          >
            {column.render 
              ? column.render(transaction, currency)
              : (transaction as Record<string, any>)[column.id]
            }
          </div>
        ))}
      </div>
    )
  }, [transactions, columns, currency, onRowClick])

  // Empty state
  if (transactions.length === 0) {
    return (
      <div 
        className={`flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`}
        data-testid={testId}
      >
        <Receipt className="w-12 h-12 text-gray-400 dark:text-slate-500 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No transactions found</p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Try adjusting your filters or adding new transactions
        </p>
      </div>
    )
  }

  return (
    <div 
      className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 ${className}`}
      data-testid={testId}
    >
      {/* Header */}
      <div 
        className="flex items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        style={{ minWidth: totalWidth }}
      >
        {columns.map(column => (
          <div
            key={column.id}
            style={{ width: column.width }}
            className={`px-3 py-3 flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider ${
              column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:bg-slate-700 dark:hover:bg-gray-700 select-none' : ''
            }`}
            onClick={() => column.sortable && handleSortClick(column.id)}
          >
            {column.label}
            {column.sortable && getSortIcon(column.id)}
          </div>
        ))}
      </div>

      {/* Virtualized list */}
      <List
        height={height}
        itemCount={transactions.length}
        itemSize={rowHeight}
        width="100%"
        className="scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
      >
        {Row}
      </List>

      {/* Footer with count */}
      <div data-testid="virtualized-transaction-table-footer" className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
        {t('common.showingTransactions', { count: transactions.length })}
      </div>
    </div>
  )
}

/**
 * Skeleton loader for VirtualizedTransactionTable
 */
export function VirtualizedTransactionTableSkeleton({
  rowCount = 5,
  rowHeight = 48,
  className = ''
}: {
  rowCount?: number
  rowHeight?: number
  className?: string
}) {
  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header skeleton */}
      <div className="flex items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-3">
        {[100, 110, 180, 250, 120, 130, 100].map((width, i) => (
          <div key={i} style={{ width }} className="px-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rowCount }).map((_, i) => (
        <div 
          key={i}
          style={{ height: rowHeight }}
          className="flex items-center border-b border-gray-200 dark:border-gray-700 px-3"
        >
          {[100, 110, 180, 250, 120, 130, 100].map((width, j) => (
            <div key={j} style={{ width }} className="px-3">
              <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default VirtualizedTransactionTable
