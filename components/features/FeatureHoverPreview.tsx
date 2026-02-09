'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { PageOrFeatureNode } from '@/types/features'
import { createPortal } from 'react-dom'

const HOVER_DELAY_MS = 350
const PREVIEW_MAX_DESC = 120

export interface FeatureHoverPreviewProps {
  node: PageOrFeatureNode | null
  anchorRect: { left: number; top: number; width: number; height: number } | null
  onClose: () => void
}

export function FeatureHoverPreview({
  node,
  anchorRect,
  onClose,
}: FeatureHoverPreviewProps) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!node || !anchorRect) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setVisible(false)
      return
    }
    timerRef.current = setTimeout(() => setVisible(true), HOVER_DELAY_MS)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setVisible(false)
    }
  }, [node?.id, anchorRect])

  if (!node || !anchorRect || !visible) return null

  const desc = (node.description ?? '').slice(0, PREVIEW_MAX_DESC)
  const truncated = (node.description ?? '').length > PREVIEW_MAX_DESC

  const content = (
    <div
      className="fixed z-[100] rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg p-3 max-w-xs pointer-events-none"
      style={{
        left: anchorRect.left,
        top: anchorRect.top + anchorRect.height + 6,
      }}
      role="tooltip"
      aria-label={`Preview: ${node.name}`}
    >
      <p className="font-medium text-sm text-gray-900 dark:text-slate-100 truncate">
        {node.name}
      </p>
      {desc ? (
        <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 line-clamp-3">
          {desc}
          {truncated ? '…' : ''}
        </p>
      ) : null}
      {node.screenshot_url ? (
        <div className="mt-2 rounded overflow-hidden border border-gray-100 dark:border-slate-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={node.screenshot_url}
            alt=""
            className="w-full h-16 object-cover object-top"
          />
        </div>
      ) : null}
    </div>
  )

  return createPortal(content, document.body)
}
