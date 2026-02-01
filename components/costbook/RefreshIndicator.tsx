'use client'

import React from 'react'
import { RefreshCw, Check, Clock } from 'lucide-react'
import { formatUpdateTime } from '@/lib/rundown-realtime'

export interface RefreshIndicatorProps {
  /** Whether currently refreshing */
  isRefreshing: boolean
  /** Last update timestamp */
  lastUpdate?: string
  /** Click handler for manual refresh */
  onRefresh?: () => void
  /** Show timestamp */
  showTimestamp?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

/**
 * Refresh indicator component
 * Shows refresh state and last update time
 */
export function RefreshIndicator({
  isRefreshing,
  lastUpdate,
  onRefresh,
  showTimestamp = true,
  size = 'md',
  className = ''
}: RefreshIndicatorProps) {
  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2'
  }
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }
  
  const buttonPadding = {
    sm: 'px-1.5 py-0.5',
    md: 'px-2 py-1',
    lg: 'px-3 py-1.5'
  }
  
  return (
    <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`
          flex items-center gap-1 rounded-full transition-all
          ${buttonPadding[size]}
          ${isRefreshing 
            ? 'bg-blue-100 text-blue-600' 
            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }
          ${onRefresh ? 'cursor-pointer' : 'cursor-default'}
        `}
        title={isRefreshing ? 'Refreshing...' : 'Refresh'}
      >
        <RefreshCw 
          className={`${iconSizes[size]} ${isRefreshing ? 'animate-spin' : ''}`} 
        />
        {isRefreshing && <span>Updating...</span>}
      </button>
      
      {/* Timestamp */}
      {showTimestamp && lastUpdate && !isRefreshing && (
        <span className="text-gray-400 flex items-center gap-1">
          <Clock className={iconSizes[size]} />
          {formatUpdateTime(lastUpdate)}
        </span>
      )}
    </div>
  )
}

/**
 * Compact refresh badge
 */
export interface RefreshBadgeProps {
  isRefreshing: boolean
  className?: string
}

export function RefreshBadge({ isRefreshing, className = '' }: RefreshBadgeProps) {
  if (!isRefreshing) return null
  
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5
      text-xs font-medium
      bg-blue-100 text-blue-700
      rounded-full
      ${className}
    `}>
      <RefreshCw className="w-3 h-3 animate-spin" />
      Syncing
    </span>
  )
}

/**
 * Success indicator for completed refresh
 */
export interface RefreshSuccessProps {
  show: boolean
  className?: string
}

export function RefreshSuccess({ show, className = '' }: RefreshSuccessProps) {
  if (!show) return null
  
  return (
    <span className={`
      inline-flex items-center gap-1 px-2 py-0.5
      text-xs font-medium
      bg-green-100 text-green-700
      rounded-full
      animate-in fade-in duration-200
      ${className}
    `}>
      <Check className="w-3 h-3" />
      Updated
    </span>
  )
}

/**
 * Pulsing indicator for real-time connection
 */
export interface ConnectionIndicatorProps {
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  showLabel?: boolean
  className?: string
}

export function ConnectionIndicator({
  status,
  showLabel = false,
  className = ''
}: ConnectionIndicatorProps) {
  const statusConfig = {
    connected: {
      color: 'bg-green-500',
      label: 'Live',
      pulse: true
    },
    connecting: {
      color: 'bg-yellow-500',
      label: 'Connecting',
      pulse: true
    },
    disconnected: {
      color: 'bg-gray-400',
      label: 'Offline',
      pulse: false
    },
    error: {
      color: 'bg-red-500',
      label: 'Error',
      pulse: false
    }
  }
  
  const config = statusConfig[status]
  
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`} />
      </span>
      {showLabel && (
        <span className="text-xs text-gray-500">{config.label}</span>
      )}
    </div>
  )
}

export default RefreshIndicator
