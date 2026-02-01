'use client'

import React from 'react'
import { MessageSquare, MessageCircle, AlertCircle } from 'lucide-react'

export interface CommentIndicatorProps {
  /** Number of comments */
  count: number
  /** Whether there are important comments */
  hasImportant?: boolean
  /** Number of recent (last 24h) comments */
  recentCount?: number
  /** Click handler */
  onClick?: (e?: React.MouseEvent) => void
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Show count label */
  showCount?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID */
  'data-testid'?: string
}

/**
 * Comment indicator badge component
 * Shows comment count with optional importance marker
 */
export function CommentIndicator({
  count,
  hasImportant = false,
  recentCount = 0,
  onClick,
  size = 'md',
  showCount = true,
  className = '',
  'data-testid': testId = 'comment-indicator'
}: CommentIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1.5'
  }
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  
  const paddingClasses = {
    sm: 'px-1.5 py-0.5',
    md: 'px-2 py-1',
    lg: 'px-3 py-1.5'
  }
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick?.(e)
  }
  
  if (count === 0) {
    return (
      <button
        onClick={handleClick}
        className={`
          inline-flex items-center ${sizeClasses[size]} ${paddingClasses[size]}
          text-gray-400 hover:text-gray-600 hover:bg-gray-100
          rounded-full transition-colors
          ${onClick ? 'cursor-pointer' : 'cursor-default'}
          ${className}
        `}
        title="No comments"
        data-testid={testId}
      >
        <MessageSquare className={iconSizes[size]} />
        {showCount && <span>0</span>}
      </button>
    )
  }
  
  const baseColor = hasImportant 
    ? 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200' 
    : recentCount > 0
      ? 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200'
      : 'text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200'
  
  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center ${sizeClasses[size]} ${paddingClasses[size]}
        ${baseColor}
        border rounded-full transition-all
        ${onClick ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}
        ${className}
      `}
      title={`${count} comment${count !== 1 ? 's' : ''}${hasImportant ? ' (important)' : ''}${recentCount > 0 ? ` (${recentCount} new)` : ''}`}
      data-testid={testId}
    >
      <MessageCircle className={iconSizes[size]} />
      {showCount && <span className="font-medium">{count}</span>}
      
      {/* Important indicator */}
      {hasImportant && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
        </span>
      )}
      
      {/* New comments indicator */}
      {!hasImportant && recentCount > 0 && (
        <span className="relative flex h-2 w-2">
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
        </span>
      )}
    </button>
  )
}

/**
 * Compact comment count badge
 */
export interface CommentCountBadgeProps {
  count: number
  className?: string
}

export function CommentCountBadge({ count, className = '' }: CommentCountBadgeProps) {
  if (count === 0) return null
  
  return (
    <span 
      className={`
        inline-flex items-center justify-center
        min-w-[1.25rem] h-5 px-1
        text-xs font-medium
        bg-gray-100 text-gray-600
        rounded-full
        ${className}
      `}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/**
 * Comment activity indicator for project header
 */
export interface CommentActivityProps {
  /** Total comment count */
  totalCount: number
  /** Recent comment count (last 24h) */
  recentCount: number
  /** Has important/flagged comments */
  hasImportant: boolean
  /** Last activity timestamp */
  lastActivity?: string
  /** Click handler */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
}

export function CommentActivity({
  totalCount,
  recentCount,
  hasImportant,
  lastActivity,
  onClick,
  className = ''
}: CommentActivityProps) {
  if (totalCount === 0) {
    return (
      <button
        onClick={onClick}
        className={`
          flex items-center gap-1.5 px-2 py-1
          text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50
          rounded-lg transition-colors
          ${className}
        `}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Add comment</span>
      </button>
    )
  }
  
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-2 py-1
        text-xs rounded-lg transition-colors
        ${hasImportant 
          ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' 
          : recentCount > 0 
            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
            : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
        }
        ${className}
      `}
    >
      <div className="flex items-center gap-1">
        <MessageCircle className="w-3.5 h-3.5" />
        <span className="font-medium">{totalCount}</span>
      </div>
      
      {recentCount > 0 && (
        <span className="text-[10px] opacity-75">
          ({recentCount} new)
        </span>
      )}
      
      {hasImportant && (
        <AlertCircle className="w-3 h-3 text-orange-500" />
      )}
    </button>
  )
}

export default CommentIndicator
