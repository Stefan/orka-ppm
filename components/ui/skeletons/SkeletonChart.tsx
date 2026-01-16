'use client'

import React from 'react'

interface SkeletonChartProps {
  className?: string
  variant?: 'bar' | 'line' | 'pie' | 'area'
  height?: string
}

export const SkeletonChart: React.FC<SkeletonChartProps> = ({ 
  className = '',
  variant = 'bar',
  height = 'h-64'
}) => {
  return (
    <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 ${className}`}>
      <div className="animate-pulse">
        {/* Chart Title */}
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-6"></div>
        
        {/* Chart Content */}
        {variant === 'bar' && (
          <div className={`flex items-end justify-between space-x-2 ${height}`}>
            {Array.from({ length: 8 }).map((_, index) => (
              <div 
                key={index} 
                className="bg-gray-200 rounded-t flex-1"
                style={{ height: `${Math.random() * 60 + 40}%` }}
              ></div>
            ))}
          </div>
        )}
        
        {variant === 'line' && (
          <div className={`relative ${height}`}>
            <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
              <path
                d="M 0 150 Q 50 100, 100 120 T 200 100 T 300 130 T 400 110"
                fill="none"
                stroke="#E5E7EB"
                strokeWidth="3"
                className="animate-pulse"
              />
            </svg>
          </div>
        )}
        
        {variant === 'pie' && (
          <div className={`flex items-center justify-center ${height}`}>
            <div className="w-40 h-40 bg-gray-200 rounded-full"></div>
          </div>
        )}
        
        {variant === 'area' && (
          <div className={`relative ${height}`}>
            <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
              <path
                d="M 0 150 Q 50 100, 100 120 T 200 100 T 300 130 T 400 110 L 400 200 L 0 200 Z"
                fill="#E5E7EB"
                className="animate-pulse"
              />
            </svg>
          </div>
        )}
        
        {/* Chart Legend */}
        <div className="flex items-center justify-center space-x-4 mt-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-200 rounded"></div>
              <div className="h-3 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SkeletonChart
