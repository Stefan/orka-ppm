'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  MessageCircle,
  Wallet,
  Database,
  BookOpen,
  Calculator,
  Upload,
  ImageIcon,
  type LucideIcon,
} from 'lucide-react'
import type { Feature } from '@/types/features'

const ICON_MAP: Record<string, LucideIcon> = {
  Wallet,
  Database,
  BookOpen,
  Calculator,
  Upload,
}

function getIcon(iconName: string | null): LucideIcon {
  if (!iconName) return BookOpen
  const Icon = ICON_MAP[iconName]
  return Icon ?? BookOpen
}

export interface FeatureDetailCardProps {
  feature: Feature | null
  onExplain?: (feature: Feature) => void
  className?: string
}

export function FeatureDetailCard({
  feature,
  onExplain,
  className = '',
}: FeatureDetailCardProps) {
  const [imageError, setImageError] = useState(false)

  if (!feature) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-500 ${className}`}
        data-testid="feature-detail-placeholder"
      >
        <p className="text-sm">Select a feature to see its description and screenshot</p>
      </div>
    )
  }

  const Icon = getIcon(feature.icon)
  const href = feature.link?.startsWith('http') ? feature.link : feature.link || '#'
  const isInternal = !feature.link?.startsWith('http')
  const hasScreenshot = Boolean(feature.screenshot_url && !imageError)

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden ${className}`}
      data-testid="feature-detail-card"
    >
      <div className="p-6">
        {/* Title and icon */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 flex-shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">{feature.name}</h2>
          </div>
        </div>

        {/* Description section – always shown */}
        <section className="mt-5" aria-labelledby="feature-description-heading">
          <h3 id="feature-description-heading" className="text-sm font-medium text-gray-700 mb-2">
            Description
          </h3>
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-4 py-3">
            {feature.description ? (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {feature.description}
              </p>
            ) : (
              <p className="text-sm text-gray-500 italic">No description yet. Add one in the feature catalog.</p>
            )}
          </div>
        </section>

        {/* Screenshot section – always shown (image or placeholder) */}
        <section className="mt-5" aria-labelledby="feature-screenshot-heading">
          <h3 id="feature-screenshot-heading" className="text-sm font-medium text-gray-700 mb-2">
            Screenshot
          </h3>
          {hasScreenshot ? (
            <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={feature.screenshot_url!}
                alt={`Screenshot for ${feature.name}`}
                className="w-full h-auto max-h-72 object-contain object-top transition-transform group-hover:scale-[1.01]"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 py-10 px-4 text-center"
              data-testid="feature-screenshot-placeholder"
            >
              <ImageIcon className="h-10 w-10 text-gray-300 mb-2" aria-hidden />
              <p className="text-sm text-gray-500">No screenshot yet</p>
              <p className="text-xs text-gray-400 mt-1">Add a screenshot in the catalog or run the screenshot script</p>
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
          {feature.link && (
            <>
              {isInternal ? (
                <Link
                  href={href}
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                  data-testid="feature-detail-link"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open feature
                </Link>
              ) : (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                  data-testid="feature-detail-link"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open link
                </a>
              )}
            </>
          )}
          {onExplain && (
            <button
              type="button"
              onClick={() => onExplain(feature)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              data-testid="feature-explain-button"
            >
              <MessageCircle className="h-4 w-4" />
              Explain
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
