'use client'

import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  variant?: 'text' | 'rectangular' | 'circular'
  animation?: 'pulse' | 'wave' | 'none'
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  variant = 'text',
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700'
  
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-md',
    circular: 'rounded-full'
  }
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-wave',
    none: ''
  }
  
  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height
  
  return (
    <div
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
      style={style}
    />
  )
}

// Predefined skeleton components for common use cases
export const TextSkeleton: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = ''
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        variant="text"
        height={16}
        width={index === lines - 1 ? '75%' : '100%'}
      />
    ))}
  </div>
)

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 border border-gray-200 dark:border-slate-700 rounded-lg ${className}`}>
    <div className="flex items-center space-x-4 mb-4">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="flex-1">
        <Skeleton variant="text" height={16} width="60%" />
        <Skeleton variant="text" height={14} width="40%" className="mt-1" />
      </div>
    </div>
    <TextSkeleton lines={3} />
  </div>
)

export const TableSkeleton: React.FC<{ 
  rows?: number
  columns?: number
  className?: string 
}> = ({ 
  rows = 5, 
  columns = 4, 
  className = '' 
}) => (
  <div className={`space-y-3 ${className}`}>
    {/* Header */}
    <div className="flex space-x-4">
      {Array.from({ length: columns }).map((_, index) => (
        <Skeleton key={index} variant="text" height={20} className="flex-1" />
      ))}
    </div>
    
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" height={16} className="flex-1" />
        ))}
      </div>
    ))}
  </div>
)

export const ChartSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 ${className}`}>
    <Skeleton variant="text" height={20} width="40%" className="mb-4" />
    <div className="flex items-end space-x-2 h-48">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rectangular"
          className="flex-1"
          height={Math.random() * 150 + 50}
        />
      ))}
    </div>
  </div>
)

export const DashboardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`space-y-6 ${className}`}>
    {/* Header */}
    <div className="flex justify-between items-center">
      <Skeleton variant="text" height={32} width="200px" />
      <Skeleton variant="rectangular" height={40} width="120px" />
    </div>
    
    {/* Stats Cards */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="p-4 border border-gray-200 dark:border-slate-700 rounded-lg">
          <Skeleton variant="text" height={14} width="60%" className="mb-2" />
          <Skeleton variant="text" height={24} width="40%" className="mb-1" />
          <Skeleton variant="text" height={12} width="80%" />
        </div>
      ))}
    </div>
    
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
    
    {/* Table */}
    <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
      <Skeleton variant="text" height={20} width="30%" className="mb-4" />
      <TableSkeleton />
    </div>
  </div>
)

export default Skeleton