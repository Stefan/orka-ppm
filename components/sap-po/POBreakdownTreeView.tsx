'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  GripVertical,
  FolderOpen,
  Folder,
  FileText,
  Edit,
  Trash2,
  Plus,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/design-system'

/**
 * PO Breakdown Item Interface
 * Requirements: 2.6, 4.2
 */
export interface POBreakdownItem {
  id: string
  name: string
  code?: string
  sap_po_number?: string
  hierarchy_level: number
  parent_breakdown_id?: string
  planned_amount: number
  committed_amount: number
  actual_amount: number
  remaining_amount: number
  currency: string
  breakdown_type: string
  category?: string
  status?: 'on-track' | 'at-risk' | 'critical'
  children?: POBreakdownItem[]
  variance_percentage?: number
}

/**
 * Tree View Props
 */
export interface POBreakdownTreeViewProps {
  data: POBreakdownItem[]
  onItemClick?: (item: POBreakdownItem) => void
  onItemEdit?: (item: POBreakdownItem) => void
  onItemDelete?: (item: POBreakdownItem) => void
  onItemAdd?: (parentItem: POBreakdownItem) => void
  onItemMove?: (itemId: string, newParentId: string | null, newPosition: number) => void
  enableDragDrop?: boolean
  enableActions?: boolean
  maxDepth?: number
  className?: string
}

/**
 * Tree Node Component
 */
interface TreeNodeProps {
  item: POBreakdownItem
  level: number
  isExpanded: boolean
  onToggle: () => void
  onItemClick?: (item: POBreakdownItem) => void
  onItemEdit?: (item: POBreakdownItem) => void
  onItemDelete?: (item: POBreakdownItem) => void
  onItemAdd?: (item: POBreakdownItem) => void
  onDragStart?: (item: POBreakdownItem) => void
  onDragOver?: (e: React.DragEvent, item: POBreakdownItem) => void
  onDrop?: (e: React.DragEvent, item: POBreakdownItem) => void
  enableDragDrop?: boolean
  enableActions?: boolean
  isDragging?: boolean
  isDropTarget?: boolean
}

const TreeNode: React.FC<TreeNodeProps> = ({
  item,
  level,
  isExpanded,
  onToggle,
  onItemClick,
  onItemEdit,
  onItemDelete,
  onItemAdd,
  onDragStart,
  onDragOver,
  onDrop,
  enableDragDrop,
  enableActions,
  isDragging,
  isDropTarget
}) => {
  const hasChildren = item.children && item.children.length > 0
  const indent = level * 24

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'critical':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
      case 'at-risk':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50'
      case 'on-track':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
      default:
        return 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50'
    }
  }

  const getVarianceColor = (variance?: number) => {
    if (!variance) return 'text-gray-600 dark:text-slate-400'
    if (variance > 10) return 'text-red-600 dark:text-red-400'
    if (variance > 5) return 'text-orange-600 dark:text-orange-400'
    if (variance < -5) return 'text-green-600 dark:text-green-400'
    return 'text-gray-600 dark:text-slate-400'
  }

  return (
    <div
      className={cn(
        'group relative',
        isDragging && 'opacity-50',
        isDropTarget && 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
      )}
      draggable={enableDragDrop}
      onDragStart={() => enableDragDrop && onDragStart?.(item)}
      onDragOver={(e) => {
        e.preventDefault()
        enableDragDrop && onDragOver?.(e, item)
      }}
      onDrop={(e) => {
        e.preventDefault()
        enableDragDrop && onDrop?.(e, item)
      }}
    >
      <div
        className={cn(
          'flex items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 cursor-pointer transition-colors',
          'border-b border-gray-100 dark:border-slate-700'
        )}
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        {/* Drag Handle */}
        {enableDragDrop && (
          <div className="mr-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          </div>
        )}

        {/* Expand/Collapse Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className={cn(
            'mr-2 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-600 dark:text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-600 dark:text-slate-400" />
          )}
        </button>

        {/* Icon */}
        <div className="mr-2">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            ) : (
              <Folder className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            )
          ) : (
            <FileText className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          )}
        </div>

        {/* Item Content */}
        <div
          className="flex-1 flex items-center justify-between min-w-0"
          onClick={() => onItemClick?.(item)}
        >
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-slate-100 truncate">
                {item.name}
              </span>
              {item.code && (
                <span className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                  {item.code}
                </span>
              )}
              {item.status && (
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  getStatusColor(item.status)
                )}>
                  {item.status}
                </span>
              )}
            </div>
            {item.sap_po_number && (
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                SAP PO: {item.sap_po_number}
              </div>
            )}
          </div>

          {/* Financial Summary */}
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="text-gray-600 dark:text-slate-400">
                {item.currency} {item.planned_amount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">Planned</div>
            </div>
            <div className="text-right">
              <div className="text-gray-900 dark:text-slate-100 font-medium">
                {item.currency} {item.actual_amount.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">Actual</div>
            </div>
            <div className="text-right">
              <div className={cn('font-medium', getVarianceColor(item.variance_percentage))}>
                {item.variance_percentage !== undefined && (
                  <>
                    {item.variance_percentage > 0 ? '+' : ''}
                    {item.variance_percentage.toFixed(1)}%
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-slate-400">Variance</div>
            </div>
          </div>

          {/* Actions */}
          {enableActions && (
            <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onItemAdd?.(item)
                }}
                className="p-1.5 text-gray-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors"
                title="Add child item"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onItemEdit?.(item)
                }}
                className="p-1.5 text-gray-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded transition-colors"
                title="Edit item"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onItemDelete?.(item)
                }}
                className="p-1.5 text-gray-600 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Delete item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * POBreakdownTreeView Component
 * 
 * Hierarchical tree view for PO breakdown management with expand/collapse
 * and drag-and-drop reordering capabilities.
 * 
 * Requirements: 2.6, 4.2
 */
export const POBreakdownTreeView: React.FC<POBreakdownTreeViewProps> = ({
  data,
  onItemClick,
  onItemEdit,
  onItemDelete,
  onItemAdd,
  onItemMove,
  enableDragDrop = true,
  enableActions = true,
  maxDepth = 10,
  className = ''
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<POBreakdownItem | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // Toggle expand/collapse
  const toggleExpand = useCallback((itemId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  // Expand all nodes
  const expandAll = useCallback(() => {
    const allIds = new Set<string>()
    const collectIds = (items: POBreakdownItem[]) => {
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          allIds.add(item.id)
          collectIds(item.children)
        }
      })
    }
    collectIds(data)
    setExpandedIds(allIds)
  }, [data])

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((item: POBreakdownItem) => {
    setDraggedItem(item)
  }, [])

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, item: POBreakdownItem) => {
    e.preventDefault()
    if (draggedItem && draggedItem.id !== item.id) {
      setDropTargetId(item.id)
    }
  }, [draggedItem])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetItem: POBreakdownItem) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem.id === targetItem.id) {
      setDraggedItem(null)
      setDropTargetId(null)
      return
    }

    // Check if target is a descendant of dragged item (prevent circular reference)
    const isDescendant = (item: POBreakdownItem, ancestorId: string): boolean => {
      if (item.id === ancestorId) return true
      if (!item.children) return false
      return item.children.some(child => isDescendant(child, ancestorId))
    }

    if (isDescendant(draggedItem, targetItem.id)) {
      alert('Cannot move an item into its own descendant')
      setDraggedItem(null)
      setDropTargetId(null)
      return
    }

    // Check depth limit
    const getDepth = (item: POBreakdownItem): number => {
      if (!item.children || item.children.length === 0) return 0
      return 1 + Math.max(...item.children.map(getDepth))
    }

    const draggedDepth = getDepth(draggedItem)
    const targetDepth = targetItem.hierarchy_level

    if (targetDepth + draggedDepth + 1 > maxDepth) {
      alert(`Cannot move item: would exceed maximum depth of ${maxDepth}`)
      setDraggedItem(null)
      setDropTargetId(null)
      return
    }

    // Perform the move
    onItemMove?.(draggedItem.id, targetItem.id, 0)
    
    setDraggedItem(null)
    setDropTargetId(null)
  }, [draggedItem, maxDepth, onItemMove])

  // Render tree recursively
  const renderTree = useCallback((items: POBreakdownItem[], level: number = 0) => {
    return items.map(item => (
      <React.Fragment key={item.id}>
        <TreeNode
          item={item}
          level={level}
          isExpanded={expandedIds.has(item.id)}
          onToggle={() => toggleExpand(item.id)}
          onItemClick={onItemClick}
          onItemEdit={onItemEdit}
          onItemDelete={onItemDelete}
          onItemAdd={onItemAdd}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          enableDragDrop={enableDragDrop}
          enableActions={enableActions}
          isDragging={draggedItem?.id === item.id}
          isDropTarget={dropTargetId === item.id}
        />
        {expandedIds.has(item.id) && item.children && item.children.length > 0 && (
          <div>
            {renderTree(item.children, level + 1)}
          </div>
        )}
      </React.Fragment>
    ))
  }, [
    expandedIds,
    toggleExpand,
    onItemClick,
    onItemEdit,
    onItemDelete,
    onItemAdd,
    handleDragStart,
    handleDragOver,
    handleDrop,
    enableDragDrop,
    enableActions,
    draggedItem,
    dropTargetId
  ])

  // Calculate totals
  const totals = useMemo(() => {
    const calculateTotals = (items: POBreakdownItem[]) => {
      return items.reduce((acc, item) => {
        acc.planned += item.planned_amount
        acc.actual += item.actual_amount
        acc.committed += item.committed_amount
        if (item.children) {
          const childTotals = calculateTotals(item.children)
          acc.planned += childTotals.planned
          acc.actual += childTotals.actual
          acc.committed += childTotals.committed
        }
        return acc
      }, { planned: 0, actual: 0, committed: 0 })
    }
    return calculateTotals(data)
  }, [data])

  if (data.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-gray-500 dark:text-slate-400', className)}>
        <AlertCircle className="h-12 w-12 mb-3 text-gray-400 dark:text-slate-500" />
        <p className="text-lg font-medium">No PO breakdown items</p>
        <p className="text-sm">Import SAP data or create items manually to get started</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700', className)}>
      {/* Header with controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">PO Breakdown Structure</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
            >
              Expand All
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
            >
              Collapse All
            </button>
          </div>
        </div>
        
        {/* Totals Summary */}
        <div className="flex items-center gap-6 text-sm">
          <div className="text-right">
            <div className="text-gray-600 dark:text-slate-400">{data[0]?.currency || 'USD'} {totals.planned.toLocaleString()}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Total Planned</div>
          </div>
          <div className="text-right">
            <div className="text-gray-900 dark:text-slate-100 font-medium">{data[0]?.currency || 'USD'} {totals.actual.toLocaleString()}</div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Total Actual</div>
          </div>
          <div className="text-right">
            <div className={cn(
              'font-medium',
              totals.actual > totals.planned ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            )}>
              {data[0]?.currency || 'USD'} {(totals.planned - totals.actual).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400">Remaining</div>
          </div>
        </div>
      </div>

      {/* Tree View */}
      <div className="overflow-auto max-h-[600px]">
        {renderTree(data)}
      </div>

      {/* Drag hint */}
      {enableDragDrop && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 text-xs text-gray-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Drag items to reorder or move them in the hierarchy
          </span>
        </div>
      )}
    </div>
  )
}

export default POBreakdownTreeView
