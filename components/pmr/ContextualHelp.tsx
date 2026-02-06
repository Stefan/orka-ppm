'use client'

import React, { useState, useRef, useEffect } from 'react'
import { HelpCircle, X, ExternalLink, BookOpen, Video, MessageCircle } from 'lucide-react'
import { createPortal } from 'react-dom'

export interface HelpContent {
  title: string
  description: string
  steps?: string[]
  tips?: string[]
  relatedTopics?: Array<{
    title: string
    href: string
  }>
  videoUrl?: string
  docsUrl?: string
}

export interface ContextualHelpProps {
  content: HelpContent
  position?: 'top' | 'bottom' | 'left' | 'right'
  trigger?: 'hover' | 'click'
  className?: string
  iconClassName?: string
  tooltipClassName?: string
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  content,
  position = 'top',
  trigger = 'hover',
  className = '',
  iconClassName = '',
  tooltipClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Calculate tooltip position
  useEffect(() => {
    if (!isOpen || !triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const padding = 8

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - padding
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'bottom':
        top = triggerRect.bottom + padding
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
        break
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.left - tooltipRect.width - padding
        break
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2
        left = triggerRect.right + padding
        break
    }

    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left < padding) left = padding
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding
    }
    if (top < padding) top = padding
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding
    }

    setTooltipPosition({ top, left })
  }, [isOpen, position])

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setIsOpen(true)
    }
  }

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      timeoutRef.current = setTimeout(() => {
        setIsOpen(false)
      }, 200)
    }
  }

  const handleClick = () => {
    if (trigger === 'click') {
      setIsOpen(!isOpen)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    if (!isOpen || trigger !== 'click') return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, trigger])

  const tooltip = isOpen && (
    <div
      ref={tooltipRef}
      className={`fixed z-50 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 ${tooltipClassName}`}
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-start space-x-2 flex-1">
          <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{content.title}</h3>
        </div>
        {trigger === 'click' && (
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {/* Description */}
        <p className="text-sm text-gray-700 dark:text-slate-300">{content.description}</p>

        {/* Steps */}
        {content.steps && content.steps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-slate-100 mb-2">How to use:</h4>
            <ol className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
              {content.steps.map((step, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="flex-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Tips */}
        {content.tips && content.tips.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3">
            <h4 className="text-xs font-semibold text-blue-900 mb-2">💡 Tips:</h4>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              {content.tips.map((tip, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span className="flex-1">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Related Topics */}
        {content.relatedTopics && content.relatedTopics.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-900 dark:text-slate-100 mb-2">Related topics:</h4>
            <div className="space-y-1">
              {content.relatedTopics.map((topic, index) => (
                <a
                  key={index}
                  href={topic.href}
                  className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>{topic.title}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700 rounded-b-lg">
        <div className="flex items-center space-x-2">
          {content.videoUrl && (
            <a
              href={content.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 transition-colors"
            >
              <Video className="h-3 w-3" />
              <span>Watch video</span>
            </a>
          )}
          {content.docsUrl && (
            <a
              href={content.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              <span>Read docs</span>
            </a>
          )}
        </div>
        <button
          onClick={() => {
            // Open help chat with pre-filled question
            console.log('Open help chat with context:', content.title)
          }}
          className="flex items-center space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          <span>Ask AI</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className={`inline-flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-blue-600 transition-colors ${className}`}
        aria-label="Help"
      >
        <HelpCircle className={`h-4 w-4 ${iconClassName}`} />
      </button>
      {typeof window !== 'undefined' && createPortal(tooltip, document.body)}
    </>
  )
}

export default ContextualHelp
