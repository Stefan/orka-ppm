'use client'

import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Layout, FileText, BookOpen, type LucideIcon } from 'lucide-react'
import type { DocTreeNode } from '@/types/features'

const DOC_ICON_MAP: Record<string, LucideIcon> = {
  Layout,
  FileText,
  BookOpen,
}

function getDocIcon(iconName: string | null): LucideIcon {
  if (!iconName) return FileText
  const Icon = DOC_ICON_MAP[iconName]
  return Icon ?? FileText
}

export interface DocTreeProps {
  nodes: DocTreeNode[]
  selectedId: string | null
  onSelect: (node: DocTreeNode) => void
  highlightIds?: Set<string>
  className?: string
}

export function DocTree({
  nodes,
  selectedId,
  onSelect,
  highlightIds = new Set(),
  className = '',
}: DocTreeProps) {
  return (
    <div className={`overflow-y-auto ${className}`} data-testid="doc-tree">
      {nodes.map((node) => (
        <DocTreeNodeComp
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          highlightIds={highlightIds}
          depth={0}
        />
      ))}
    </div>
  )
}

interface DocTreeNodeCompProps {
  node: DocTreeNode
  selectedId: string | null
  onSelect: (node: DocTreeNode) => void
  highlightIds: Set<string>
  depth: number
}

function DocTreeNodeComp({ node, selectedId, onSelect, highlightIds, depth }: DocTreeNodeCompProps) {
  const [open, setOpen] = useState(true)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id
  const isHighlighted = highlightIds.has(node.id)
  const Icon = getDocIcon(node.icon)

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-colors
          ${isSelected ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'}
          ${isHighlighted ? 'ring-1 ring-blue-300' : ''}
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onSelect(node)}
        data-testid={`doc-tree-node-${node.id}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect(node)
          }
          if (e.key === 'ArrowRight' && hasChildren) setOpen(true)
          if (e.key === 'ArrowLeft' && hasChildren) setOpen(false)
        }}
      >
        <button
          type="button"
          className="p-0.5 rounded hover:bg-gray-200"
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) setOpen((o) => !o)
          }}
          aria-expanded={hasChildren ? open : undefined}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )
          ) : (
            <span className="w-4 h-4 inline-block" />
          )}
        </button>
        <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
        <span className="truncate font-medium text-sm">{node.name}</span>
      </div>
      {hasChildren && open && (
        <div className="border-l border-gray-200 ml-4">
          {node.children.map((child) => (
            <DocTreeNodeComp
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              highlightIds={highlightIds}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
