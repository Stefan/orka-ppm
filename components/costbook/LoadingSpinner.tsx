'use client'

import React from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Optional message to display */
  message?: string
  /** Spinner variant */
  variant?: 'spinner' | 'dots' | 'pulse'
  /** Whether to show as overlay */
  overlay?: boolean
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

/**
 * Dot loading animation
 */
function DotsLoader({ size }: { size: string }) {
  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  }

  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`
            ${dotSizes[size as keyof typeof dotSizes]}
            bg-blue-500
            rounded-full
            animate-bounce
          `}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

/**
 * Pulse loading animation
 */
function PulseLoader({ size }: { size: string }) {
  const pulseSizes = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  }

  return (
    <div className={`relative ${pulseSizes[size as keyof typeof pulseSizes]}`}>
      <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
      <div className="relative rounded-full bg-blue-500 w-full h-full" />
    </div>
  )
}

/**
 * LoadingSpinner component for Costbook
 * Animated loading indicator with optional message
 */
export function LoadingSpinner({
  size = 'md',
  message,
  variant = 'spinner',
  overlay = false,
  className = '',
  'data-testid': testId = 'loading-spinner'
}: LoadingSpinnerProps) {
  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const messageSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  }

  const content = (
    <div 
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      {variant === 'spinner' && (
        <Loader2 
          className={`${spinnerSizes[size]} text-blue-500 animate-spin`} 
        />
      )}
      
      {variant === 'dots' && <DotsLoader size={size} />}
      
      {variant === 'pulse' && <PulseLoader size={size} />}
      
      {message && (
        <span className={`${messageSizes[size]} text-gray-500 font-medium`}>
          {message}
        </span>
      )}
      
      <span className="sr-only">Loading...</span>
    </div>
  )

  if (overlay) {
    return (
      <div 
        className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50"
        data-testid={`${testId}-overlay`}
      >
        {content}
      </div>
    )
  }

  return content
}

/**
 * Skeleton loading placeholder
 */
export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  lines = 1
}: {
  className?: string
  variant?: 'rectangular' | 'circular' | 'text'
  width?: string | number
  height?: string | number
  lines?: number
}) {
  const baseClass = 'bg-gray-200 animate-pulse'
  
  if (variant === 'circular') {
    return (
      <div 
        className={`${baseClass} rounded-full ${className}`}
        style={{ width, height }}
      />
    )
  }

  if (variant === 'text') {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div 
            key={i}
            className={`${baseClass} rounded h-4`}
            style={{ 
              width: i === lines - 1 && lines > 1 ? '75%' : '100%',
              height 
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div 
      className={`${baseClass} rounded ${className}`}
      style={{ width, height }}
    />
  )
}

/**
 * Card skeleton for project cards
 */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 min-h-[320px] min-w-[280px] w-full ${className}`}>
      <div className="flex justify-between mb-3">
        <Skeleton variant="text" className="w-2/3" />
        <Skeleton variant="rectangular" className="w-16 h-6 rounded-full" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex justify-between">
          <Skeleton variant="rectangular" className="w-16 h-4" />
          <Skeleton variant="rectangular" className="w-20 h-4" />
        </div>
        <div className="flex justify-between">
          <Skeleton variant="rectangular" className="w-16 h-4" />
          <Skeleton variant="rectangular" className="w-20 h-4" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="w-full h-2 rounded-full" />
    </div>
  )
}

/**
 * Inline loading indicator
 */
export function InlineLoader({
  message = 'Loading...',
  className = ''
}: {
  message?: string
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-gray-500 ${className}`}>
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span className="text-sm">{message}</span>
    </span>
  )
}

export default LoadingSpinner