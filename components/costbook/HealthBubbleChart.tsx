'use client'

import React from 'react'
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  ReferenceArea
} from 'recharts'
import { ProjectWithFinancials, Currency, ProjectStatus } from '@/types/costbook'
import { formatCurrency } from '@/lib/currency-utils'

export interface HealthBubbleChartProps {
  /** Array of projects with financial data */
  projects: ProjectWithFinancials[]
  /** Currency for formatting */
  currency: Currency
  /** Chart height */
  height?: number
  /** Handler for project click */
  onProjectClick?: (project: ProjectWithFinancials) => void
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

interface BubbleDataPoint {
  id: string
  name: string
  x: number  // Variance
  y: number  // Health score
  z: number  // Total spend (bubble size)
  status: string
  project: ProjectWithFinancials
}

/**
 * Get color based on project status and health
 */
function getBubbleColor(status: string, health: number): string {
  // Override color if health is critical
  if (health < 25) return '#EF4444' // Red
  if (health < 50) return '#F97316' // Orange
  if (health < 75) return '#EAB308' // Yellow
  
  // Otherwise use status-based colors
  const statusColors: Record<string, string> = {
    [ProjectStatus.ACTIVE]: '#22C55E',    // Green
    [ProjectStatus.ON_HOLD]: '#EAB308',   // Yellow
    [ProjectStatus.COMPLETED]: '#3B82F6', // Blue
    [ProjectStatus.CANCELLED]: '#9CA3AF', // Gray
    'at_risk': '#EF4444'                  // Red
  }
  
  return statusColors[status] || '#6B7280'
}

/**
 * Custom tooltip for bubble chart
 */
function CustomTooltip({ 
  active, 
  payload,
  currency
}: { 
  active?: boolean
  payload?: any[]
  currency: Currency
}) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as BubbleDataPoint
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg max-w-[200px]">
        <p className="font-medium text-gray-900 mb-2 truncate">{data.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Health:</span>
            <span className="font-medium">{data.y}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Variance:</span>
            <span className={`font-medium ${data.x >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(data.x, currency)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Spend:</span>
            <span className="font-medium">{formatCurrency(data.z, currency)}</span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

/**
 * HealthBubbleChart component for Costbook
 * Visualizes project health vs variance with bubble size representing spend
 */
export function HealthBubbleChart({
  projects,
  currency,
  height = 250,
  onProjectClick,
  className = '',
  'data-testid': testId = 'health-bubble-chart'
}: HealthBubbleChartProps) {
  // Transform projects to bubble data
  const data: BubbleDataPoint[] = projects.map(project => ({
    id: project.id,
    name: project.name,
    x: project.variance,
    y: project.health_score,
    z: project.total_spend,
    status: project.status,
    project
  }))

  // Calculate domain ranges
  const varianceRange = data.length > 0 
    ? [
        Math.min(...data.map(d => d.x), 0) * 1.1,
        Math.max(...data.map(d => d.x), 0) * 1.1
      ]
    : [-100000, 100000]

  const spendRange = data.length > 0
    ? [Math.min(...data.map(d => d.z)), Math.max(...data.map(d => d.z))]
    : [0, 100000]

  // Format axis values
  const formatXAxis = (value: number) => {
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toString()
  }

  const handleClick = (data: any) => {
    if (onProjectClick && data?.payload?.project) {
      onProjectClick(data.payload.project)
    }
  }

  return (
    <div 
      className={`w-full ${className}`} 
      data-testid={testId}
    >
      <h4 className="text-sm font-medium text-gray-700 mb-2">
        Project Health vs Variance
        <span className="ml-2 text-xs text-gray-500 font-normal">
          (Bubble size = Total Spend)
        </span>
      </h4>
      
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          
          {/* Quadrant backgrounds */}
          <ReferenceArea 
            x1={0} 
            x2={varianceRange[1]} 
            y1={50} 
            y2={100} 
            fill="#22C55E" 
            fillOpacity={0.05}
          />
          <ReferenceArea 
            x1={varianceRange[0]} 
            x2={0} 
            y1={50} 
            y2={100} 
            fill="#EAB308" 
            fillOpacity={0.05}
          />
          <ReferenceArea 
            x1={0} 
            x2={varianceRange[1]} 
            y1={0} 
            y2={50} 
            fill="#EAB308" 
            fillOpacity={0.05}
          />
          <ReferenceArea 
            x1={varianceRange[0]} 
            x2={0} 
            y1={0} 
            y2={50} 
            fill="#EF4444" 
            fillOpacity={0.05}
          />
          
          <XAxis 
            type="number" 
            dataKey="x" 
            name="Variance"
            domain={varianceRange}
            tickFormatter={formatXAxis}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            label={{ 
              value: 'Variance', 
              position: 'bottom', 
              fontSize: 11, 
              fill: '#6B7280',
              offset: 0
            }}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            name="Health"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            label={{ 
              value: 'Health', 
              angle: -90, 
              position: 'insideLeft', 
              fontSize: 11, 
              fill: '#6B7280'
            }}
          />
          <ZAxis 
            type="number" 
            dataKey="z" 
            range={[50, 400]} 
            name="Spend"
            domain={spendRange}
          />
          
          <ReferenceLine x={0} stroke="#9CA3AF" strokeDasharray="3 3" />
          <ReferenceLine y={50} stroke="#9CA3AF" strokeDasharray="3 3" />
          
          <Tooltip content={<CustomTooltip currency={currency} />} />
          
          <Scatter 
            name="Projects" 
            data={data}
            onClick={handleClick}
            cursor={onProjectClick ? 'pointer' : 'default'}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={getBubbleColor(entry.status, entry.y)}
                fillOpacity={0.7}
                stroke={getBubbleColor(entry.status, entry.y)}
                strokeWidth={1}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Quadrant Legend */}
      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500/20 border border-green-500 rounded" />
          <span className="text-gray-600">Healthy & Under Budget</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-yellow-500/20 border border-yellow-500 rounded" />
          <span className="text-gray-600">Healthy & Over Budget</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-yellow-500/20 border border-yellow-500 rounded" />
          <span className="text-gray-600">At Risk & Under Budget</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500/20 border border-red-500 rounded" />
          <span className="text-gray-600">At Risk & Over Budget</span>
        </div>
      </div>
    </div>
  )
}

export default HealthBubbleChart