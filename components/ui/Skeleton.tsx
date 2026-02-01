'use client'

import React from 'react'
import { cn } from '../../lib/utils/design-system'

interface SkeletonProps {
  className?: string
  variant?: 'default' | 'card' | 'chart' | 'table' | 'text'
  lines?: number
  height?: string | number
  width?: string | number
}

export function Skeleton({
  className,
  variant = 'default',
  lines = 1,
  height,
  width
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200 rounded'

  // Predefined skeleton variants with stable dimensions
  const variants = {
    default: 'h-4 w-full',
    card: 'h-48 w-full', // Fixed height for cards
    chart: 'h-64 w-full', // Fixed height for charts
    table: 'h-32 w-full', // Fixed height for tables
    text: 'h-4'
  }

  const getSkeletonLines = () => {
    if (variant === 'text' && lines > 1) {
      return Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn(
            baseClasses,
            variants.text,
            i === lines - 1 ? 'w-3/4' : 'w-full', // Last line shorter
            'mb-2'
          )}
          style={{ height: height || undefined, width: width || undefined }}
        />
      ))
    }

    return (
      <div
        className={cn(baseClasses, variants[variant], className)}
        style={{
          height: height || undefined,
          width: width || undefined,
          // CSS containment for better performance
          contain: 'layout style paint'
        }}
      />
    )
  }

  return <>{getSkeletonLines()}</>
}

// Specialized skeleton components for common use cases
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 border border-gray-200 rounded-lg', className)}>
      <Skeleton variant="text" lines={1} className="mb-4 w-1/3" />
      <Skeleton variant="text" lines={2} className="mb-4" />
      <div className="flex space-x-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    </div>
  )
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-4 border border-gray-200 rounded-lg', className)}>
      <Skeleton variant="text" className="mb-4 w-1/4" />
      <Skeleton variant="chart" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Table header skeleton */}
      <div className="bg-gray-50 p-4 border-b border-gray-200">
        <div className="flex space-x-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      {/* Table rows skeleton */}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="p-4 border-b border-gray-100 last:border-b-0">
          <div className="flex space-x-4 items-center">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-8 rounded-full" /> {/* Avatar placeholder */}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton