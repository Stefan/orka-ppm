'use client'

import React from 'react'

interface SkeletonCardProps {
  className?: string
  variant?: 'stat' | 'project' | 'resource' | 'risk'
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  className = '',
  variant = 'stat'
}) => {
  if (variant === 'stat') {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
            <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'project') {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'resource') {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
            <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
          </div>
          <div className="mb-4">
            <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-3 bg-gray-200 rounded-full w-full"></div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'risk') {
    return (
      <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
        <div className="animate-pulse">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-8 h-8 bg-gray-200 rounded"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default SkeletonCard
