'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink, Layout } from 'lucide-react'
import type { PageOrFeatureNode } from '@/types/features'

export interface PageDetailCardProps {
  node: PageOrFeatureNode | null
  className?: string
}

export function PageDetailCard({ node, className = '' }: PageDetailCardProps) {
  // #region agent log (only when NEXT_PUBLIC_AGENT_INGEST_URL is set to avoid ERR_CONNECTION_REFUSED in Lighthouse)
  const ingestUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_AGENT_INGEST_URL : undefined
  if (ingestUrl && node && typeof fetch !== 'undefined') {
    fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'components/features/PageDetailCard.tsx',
        message: 'PageDetailCard render',
        data: { nodeId: node.id, nodeDescLen: node.description?.length ?? 0, rendersDescription: Boolean(node.description) },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'H5',
      }),
    }).catch(() => {})
  }
  // #endregion
  if (!node) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500 ${className}`}
        data-testid="page-detail-placeholder"
      >
        <p className="text-sm">Select a page or feature from the tree</p>
      </div>
    )
  }

  const href = node.link?.startsWith('http') ? node.link : node.link || '#'
  const isInternal = node.link && !node.link.startsWith('http')

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden ${className}`}
      data-testid="page-detail-card"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 flex-shrink-0">
            <Layout className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">App page</p>
            <h2 className="text-xl font-semibold text-gray-900 mt-0.5">{node.name}</h2>
            {node.description ? (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{node.description}</p>
            ) : (
              <p className="text-sm text-gray-600 mt-2">
                Sub-features for this page are listed below in the tree. Select a feature to see its description and screenshot.
              </p>
            )}
          </div>
        </div>
        {node.link && (
          <div className="mt-4">
            {isInternal ? (
              <Link
                href={href}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                data-testid="page-detail-link"
              >
                <ExternalLink className="h-4 w-4" />
                Open page
              </Link>
            ) : (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                data-testid="page-detail-link"
              >
                <ExternalLink className="h-4 w-4" />
                Open link
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
