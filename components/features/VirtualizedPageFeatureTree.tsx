'use client'

import React, { useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'
import { ChevronRight, ChevronDown, Layout, Wallet, Database, BookOpen, Calculator, Upload, type LucideIcon } from 'lucide-react'
import type { PageOrFeatureNode } from '@/types/features'

const ICON_MAP: Record<string, LucideIcon> = {
  Layout,
  Wallet,
  Database,
  BookOpen,
  Calculator,
  Upload,
}

function getIcon(iconName: string | null, isPage: boolean): LucideIcon {
  if (isPage) return Layout
  if (!iconName) return BookOpen
  const Icon = ICON_MAP[iconName]
  return Icon ?? BookOpen
}

export interface VisibleRow {
  node: PageOrFeatureNode
  depth: number
}

function flattenVisible(
  nodes: PageOrFeatureNode[],
  expandedIds: Set<string>,
  depth: number
): VisibleRow[] {
  const out: VisibleRow[] = []
  for (const node of nodes) {
    out.push({ node, depth })
    const hasChildren = node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    if (hasChildren && isExpanded) {
      out.push(...flattenVisible(node.children, expandedIds, depth + 1))
    }
  }
  return out
}

const ROW_HEIGHT = 40

export interface VirtualizedPageFeatureTreeProps {
  nodes: PageOrFeatureNode[]
  selectedId: string | null
  onSelect: (node: PageOrFeatureNode) => void
  highlightIds?: Set<string>
  expandedIds: Set<string>
  onExpandedIdsChange: (next: Set<string>) => void
  onHoverNode?: (node: PageOrFeatureNode | null, rect: DOMRect | null) => void
  className?: string
  height: number
}

export function VirtualizedPageFeatureTree({
  nodes,
  selectedId,
  onSelect,
  highlightIds = new Set(),
  expandedIds,
  onExpandedIdsChange,
  onHoverNode,
  className = '',
  height,
}: VirtualizedPageFeatureTreeProps) {
  const visibleRows = useMemo(
    () => flattenVisible(nodes, expandedIds, 0),
    [nodes, expandedIds]
  )

  const toggleExpand = (node: PageOrFeatureNode) => {
    const next = new Set(expandedIds)
    if (next.has(node.id)) next.delete(node.id)
    else next.add(node.id)
    onExpandedIdsChange(next)
  }

  return (
    <div className={className} data-testid="virtualized-page-feature-tree">
      <List
        height={height}
        itemCount={visibleRows.length}
        itemSize={ROW_HEIGHT}
        width="100%"
        overscanCount={5}
      >
        {({ index, style }) => {
          const { node, depth } = visibleRows[index]
          const hasChildren = node.children.length > 0
          const isOpen = expandedIds.has(node.id)
          const isSelected = selectedId === node.id
          const isHighlighted = highlightIds.has(node.id)
          const isPage = node.feature === null
          const Icon = getIcon(node.icon, isPage)

          return (
            <div style={style} className="flex items-stretch">
              <div
                className={`
                  flex items-center gap-2 flex-1 min-w-0 px-3 rounded-lg cursor-pointer transition-colors
                  ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-slate-200'}
                  ${isHighlighted ? 'ring-1 ring-blue-300 dark:ring-blue-600' : ''}
                `}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                onClick={() => onSelect(node)}
                onMouseEnter={(e) => {
                  const el = e.currentTarget
                  onHoverNode?.(node, el.getBoundingClientRect())
                }}
                onMouseLeave={() => onHoverNode?.(null, null)}
                data-testid={`page-feature-tree-node-${node.id}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(node)
                  }
                  if (e.key === 'ArrowRight' && hasChildren) {
                    e.preventDefault()
                    if (!isOpen) toggleExpand(node)
                  }
                  if (e.key === 'ArrowLeft' && hasChildren) {
                    e.preventDefault()
                    if (isOpen) toggleExpand(node)
                  }
                }}
              >
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-slate-600 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (hasChildren) toggleExpand(node)
                  }}
                  aria-expanded={hasChildren ? isOpen : undefined}
                >
                  {hasChildren ? (
                    isOpen ? (
                      <ChevronDown className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    )
                  ) : (
                    <span className="w-4 h-4 inline-block" />
                  )}
                </button>
                <Icon className="w-4 h-4 text-gray-600 dark:text-slate-300 flex-shrink-0" />
                <span className="truncate font-medium text-sm">{node.name}</span>
              </div>
            </div>
          )
        }}
      </List>
    </div>
  )
}
