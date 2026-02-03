'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Layout, ImageIcon } from 'lucide-react'
import type { PageOrFeatureNode } from '@/types/features'

export interface PageDetailCardProps {
  node: PageOrFeatureNode | null
  className?: string
}

export function PageDetailCard({ node, className = '' }: PageDetailCardProps) {
  const [imageError, setImageError] = useState(false)
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
        className={`rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-8 text-center text-gray-500 dark:text-slate-400 ${className}`}
        data-testid="page-detail-placeholder"
      >
        <p className="text-sm">Select a page or feature from the tree</p>
      </div>
    )
  }

  const href = node.link?.startsWith('http') ? node.link : node.link || '#'
  const isInternal = node.link && !node.link.startsWith('http')
  const hasScreenshot = Boolean(node.screenshot_url && !imageError)

  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden ${className}`}
      data-testid="page-detail-card"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0">
            <Layout className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">App page</p>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mt-0.5">{node.name}</h2>
            {node.description ? (
              <p className="text-sm text-gray-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">{node.description}</p>
            ) : (
              <p className="text-sm text-gray-600 dark:text-slate-300 mt-2">
                Sub-features for this page are listed below in the tree. Select a feature to see its description and screenshot.
              </p>
            )}
          </div>
        </div>

        {/* Screenshot section – shown when screenshot_url is set and image loads */}
        <section className="mt-5" aria-labelledby="page-screenshot-heading">
          <h3 id="page-screenshot-heading" className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Screenshot
          </h3>
          {hasScreenshot ? (
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={node.screenshot_url!}
                alt={`Screenshot for ${node.name}`}
                className="w-full h-auto max-h-72 object-contain object-top transition-transform group-hover:scale-[1.01]"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 py-10 px-4 text-center"
              data-testid="page-screenshot-placeholder"
            >
              <ImageIcon className="h-10 w-10 text-gray-300 dark:text-slate-600 mb-2" aria-hidden />
              <p className="text-sm text-gray-500 dark:text-slate-400">No screenshot yet</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                Add an image to public/feature-screenshots/ or run npm run feature-screenshots
              </p>
            </div>
          )}
        </section>

        {node.link && (
          <div className="mt-4">
            {isInternal ? (
              <Link
                href={href}
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
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
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
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
