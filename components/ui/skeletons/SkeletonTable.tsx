'use client'

import React from 'react'

interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
  showHeader?: boolean
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ 
  rows = 5,
  columns = 4,
  className = '',
  showHeader = true
}) => {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden ${className}`}>
      <div className="animate-pulse">
        {/* Table Header */}
        {showHeader && (
          <div className="bg-gray-50 dark:bg-slate-800/50 px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, index) => (
                <div key={index} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        )}
        
        {/* Table Rows */}
        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="px-6 py-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div key={colIndex} className="h-4 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SkeletonTable
