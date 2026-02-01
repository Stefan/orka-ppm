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
        <p className="text-sm">Select a feature from the tree</p>
      </div>
    )
  }

  const Icon = getIcon(feature.icon)
  const href = feature.link?.startsWith('http') ? feature.link : feature.link || '#'
  const isInternal = !feature.link?.startsWith('http')

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden ${className}`}
      data-testid="feature-detail-card"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 flex-shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-gray-900">{feature.name}</h2>
            {feature.description && (
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            )}
          </div>
        </div>

        {feature.screenshot_url && !imageError && (
          <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={feature.screenshot_url}
              alt={`Screenshot for ${feature.name}`}
              className="w-full h-auto max-h-48 object-cover object-top transition-transform group-hover:scale-[1.02]"
              onError={() => setImageError(true)}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
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
