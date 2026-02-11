'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  FileText, 
  Layers, 
  GitBranch,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'
import { HierarchyNode, Currency, CURRENCY_SYMBOLS } from '@/types/costbook'
import { formatCurrency } from '@/lib/currency-utils'
import { calculateHierarchyTotals } from '@/lib/costbook/hierarchy-builders'

export type ViewType = 'ces' | 'wbs'

export interface HierarchyTreeViewProps {
  /** Hierarchy data to display */
  data: HierarchyNode[]
  /** View type: CES or WBS */
  viewType: ViewType
  /** Currency for formatting */
  currency: Currency
  /** Handler for node selection */
  onNodeSelect?: (node: HierarchyNode) => void
  /** Currently selected node ID */
  selectedNodeId?: string
  /** Initially expanded node IDs */
  initialExpandedIds?: string[]
  /** Show budget column */
  showBudget?: boolean
  /** Show spend column */
  showSpend?: boolean
  /** Show variance column */
  showVariance?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

interface TreeNodeProps {
  node: HierarchyNode
  level: number
  currency: Currency
  expandedIds: Set<string>
  selectedNodeId?: string
  onToggle: (id: string) => void
  onSelect: (node: HierarchyNode) => void
  showBudget: boolean
  showSpend: boolean
  showVariance: boolean
}

/**
 * Single tree node component with expand/collapse functionality
 */
function TreeNode({
  node,
  level,
  currency,
  expandedIds,
  selectedNodeId,
  onToggle,
  onSelect,
  showBudget,
  showSpend,
  showVariance
}: TreeNodeProps) {
  const isExpanded = expandedIds.has(node.id)
  const isSelected = selectedNodeId === node.id
  const hasChildren = node.children.length > 0
  const indentPx = level * 24

  // Determine variance color
  const varianceColor = node.variance >= 0 
    ? 'text-green-600 dark:text-green-400' 
    : 'text-red-600 dark:text-red-400'

  // Determine variance icon
  const VarianceIcon = node.variance > 0 
    ? TrendingUp 
    : node.variance < 0 
      ? TrendingDown 
      : Minus

  // Get appropriate folder/file icon
  const getNodeIcon = () => {
    if (!hasChildren) {
      return <FileText className="w-4 h-4 text-gray-400 dark:text-slate-500" />
    }
    return isExpanded 
      ? <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
      : <Folder className="w-4 h-4 text-blue-500 dark:text-blue-400" />
  }

  return (
    <>
      <div
        className={`
          flex items-center py-2 px-3 border-b border-gray-100 dark:border-gray-800
          hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer
          ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500' : ''}
        `}
        onClick={() => onSelect(node)}
        data-testid={`tree-node-${node.id}`}
      >
        {/* Indent and expand/collapse */}
        <div 
          className="flex items-center flex-shrink-0"
          style={{ paddingLeft: indentPx }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggle(node.id)
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded 
                ? <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              }
            </button>
          ) : (
            <span className="w-6" /> // Spacer for alignment
          )}
          
          {/* Node icon */}
          <span className="ml-1 mr-2">
            {getNodeIcon()}
          </span>
        </div>

        {/* Node name */}
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium truncate ${
            isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {node.name}
          </span>
          {level === 0 && (
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
              ({node.children.length} items)
            </span>
          )}
        </div>

        {/* Budget column */}
        {showBudget && (
          <div className="w-28 text-right text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
            {formatCurrency(node.total_budget, currency)}
          </div>
        )}

        {/* Spend column */}
        {showSpend && (
          <div className="w-28 text-right text-sm font-medium text-gray-900 dark:text-gray-100 flex-shrink-0">
            {formatCurrency(node.total_spend, currency)}
          </div>
        )}

        {/* Variance column */}
        {showVariance && (
          <div className={`w-28 text-right text-sm font-medium flex-shrink-0 flex items-center justify-end gap-1 ${varianceColor}`}>
            <VarianceIcon className="w-3 h-3" />
            {formatCurrency(Math.abs(node.variance), currency)}
          </div>
        )}
      </div>

      {/* Children (if expanded) */}
      {isExpanded && hasChildren && (
        <div className="relative">
          {/* Connecting line */}
          <div 
            className="absolute left-0 top-0 bottom-0 border-l border-gray-200 dark:border-gray-700"
            style={{ marginLeft: indentPx + 18 }}
          />
          
          {node.children.map((child, index) => (
            <TreeNode
              key={`${child.id}-${index}`}
              node={child}
              level={level + 1}
              currency={currency}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
              showBudget={showBudget}
              showSpend={showSpend}
              showVariance={showVariance}
            />
          ))}
        </div>
      )}
    </>
  )
}

/**
 * HierarchyTreeView component for displaying CES/WBS hierarchies
 * Renders collapsible tree structure with aggregated totals at each level
 */
export function HierarchyTreeView({
  data,
  viewType,
  currency,
  onNodeSelect,
  selectedNodeId,
  initialExpandedIds = [],
  showBudget = true,
  showSpend = true,
  showVariance = true,
  className = '',
  'data-testid': testId = 'hierarchy-tree-view'
}: HierarchyTreeViewProps) {
  // Track expanded nodes
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(initialExpandedIds)
  )

  // Toggle node expansion
  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Handle node selection
  const handleSelect = useCallback((node: HierarchyNode) => {
    onNodeSelect?.(node)
  }, [onNodeSelect])

  // Expand/collapse all
  const expandAll = useCallback(() => {
    const getAllIds = (nodes: HierarchyNode[]): string[] => {
      return nodes.flatMap(node => [
        node.id,
        ...getAllIds(node.children)
      ])
    }
    setExpandedIds(new Set(getAllIds(data)))
  }, [data])

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set())
  }, [])

  // Calculate totals
  const totals = useMemo(() => calculateHierarchyTotals(data), [data])

  // Empty state
  if (data.length === 0) {
    return (
      <div 
        className={`flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`}
        data-testid={testId}
      >
        {viewType === 'ces' ? (
          <Layers className="w-12 h-12 text-gray-400 dark:text-slate-500 mb-4" />
        ) : (
          <GitBranch className="w-12 h-12 text-gray-400 dark:text-slate-500 mb-4" />
        )}
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
          No {viewType === 'ces' ? 'CES' : 'WBS'} data available
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
          Add commitments to build the hierarchy
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
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {viewType === 'ces' ? (
            <Layers className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          ) : (
            <GitBranch className="w-5 h-5 text-purple-500" />
          )}
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {viewType === 'ces' ? 'Cost Element Structure' : 'Work Breakdown Structure'}
          </h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center py-2 px-3 bg-gray-100 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
        <div className="flex-1 pl-8">Name</div>
        {showBudget && <div className="w-28 text-right">Budget</div>}
        {showSpend && <div className="w-28 text-right">Spend</div>}
        {showVariance && <div className="w-28 text-right">Variance</div>}
      </div>

      {/* Tree content */}
      <div className="min-h-[50px] max-h-[1000px] overflow-y-auto">
        {data.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            currency={currency}
            expandedIds={expandedIds}
            selectedNodeId={selectedNodeId}
            onToggle={handleToggle}
            onSelect={handleSelect}
            showBudget={showBudget}
            showSpend={showSpend}
            showVariance={showVariance}
          />
        ))}
      </div>

      {/* Footer with totals */}
      <div className="flex items-center py-3 px-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="flex-1 pl-8 text-sm font-semibold text-gray-900 dark:text-gray-100">
          Total
        </div>
        {showBudget && (
          <div className="w-28 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">
            {formatCurrency(totals.totalBudget, currency)}
          </div>
        )}
        {showSpend && (
          <div className="w-28 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(totals.totalSpend, currency)}
          </div>
        )}
        {showVariance && (
          <div className={`w-28 text-right text-sm font-semibold ${
            totals.totalVariance >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {totals.totalVariance >= 0 ? '+' : ''}{formatCurrency(totals.totalVariance, currency)}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Skeleton loader for HierarchyTreeView
 */
export function HierarchyTreeViewSkeleton({
  rowCount = 5,
  className = ''
}: {
  rowCount?: number
  className?: string
}) {
  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Row skeletons */}
      {Array.from({ length: rowCount }).map((_, i) => (
        <div 
          key={i}
          className="flex items-center py-3 px-3 border-b border-gray-100 dark:border-gray-800"
          style={{ paddingLeft: (i % 3) * 24 + 12 }}
        >
          <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mr-2" />
          <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
          <div className="w-24 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse ml-4" />
          <div className="w-24 h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse ml-4" />
        </div>
      ))}
    </div>
  )
}

export default HierarchyTreeView
