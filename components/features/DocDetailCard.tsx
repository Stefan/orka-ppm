'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink, FileText, Layout, BookOpen, type LucideIcon } from 'lucide-react'
import type { DocItem } from '@/types/features'

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

export interface DocDetailCardProps {
  item: DocItem | null
  className?: string
}

export function DocDetailCard({ item, className = '' }: DocDetailCardProps) {
  if (!item) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500 ${className}`}
        data-testid="doc-detail-placeholder"
      >
        <p className="text-sm">Select a spec or doc to see its description</p>
      </div>
    )
  }

  const Icon = getDocIcon(item.icon)
  const href = item.link?.startsWith('http') ? item.link : item.link || '#'
  const isInternal = item.link && !item.link.startsWith('http')
  const isSection = item.id.startsWith('section:')

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden ${className}`}
      data-testid="doc-detail-card"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 flex-shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">{item.name}</h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {item.source}
              </span>
            </div>
            {item.description && (
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.description}</p>
            )}
          </div>
        </div>

        {!isSection && item.sourcePath && (
          <p className="mt-3 text-xs font-mono text-gray-500 truncate" title={item.sourcePath}>
            {item.sourcePath}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {item.link && !isSection && (
            <>
              {isInternal ? (
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                  data-testid="doc-detail-link"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open in app
                </Link>
              ) : (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                  data-testid="doc-detail-link"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open link
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
