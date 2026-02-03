'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts'
import { Currency } from '@/types/costbook'
import { formatCurrency } from '@/lib/currency-utils'

export interface VarianceWaterfallProps {
  /** Total budget amount */
  totalBudget: number
  /** Total commitments amount */
  totalCommitments: number
  /** Total actuals amount */
  totalActuals: number
  /** Variance amount (budget - spend) */
  variance: number
  /** Currency for formatting */
  currency: Currency
  /** Chart height */
  height?: number
  /** Additional CSS classes */
  className?: string
  /** Test ID for testing */
  'data-testid'?: string
}

interface WaterfallDataPoint {
  name: string
  value: number
  fill: string
  isPositive: boolean
  displayValue: number
}

/**
 * Custom tooltip component for the waterfall chart
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
    const data = payload[0].payload as WaterfallDataPoint
    return (
      <div className="bg-white dark:bg-slate-800 p-3 border border-gray-200 dark:border-slate-600 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 dark:text-slate-100 mb-1">{data.name}</p>
        <p className={`text-sm font-bold ${data.isPositive ? 'text-green-600 dark:text-green-400' : data.value < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-slate-200'}`}>
          {formatCurrency(data.displayValue, currency)}
        </p>
      </div>
    )
  }
  return null
}

/**
 * VarianceWaterfall chart component for Costbook
 * Visualizes the budget breakdown as a waterfall chart
 * 
 * Budget (starting) -> Commitments (decrease) -> Actuals (decrease) -> Variance (ending)
 */
export function VarianceWaterfall({
  totalBudget,
  totalCommitments,
  totalActuals,
  variance,
  currency,
  height = 250,
  className = '',
  'data-testid': testId = 'variance-waterfall'
}: VarianceWaterfallProps) {
  // Prepare data for waterfall chart
  // We'll use a stacked approach where each bar shows cumulative value
  const data: WaterfallDataPoint[] = [
    {
      name: 'Budget',
      value: totalBudget,
      fill: '#3B82F6', // Blue
      isPositive: true,
      displayValue: totalBudget
    },
    {
      name: 'Commitments',
      value: -totalCommitments,
      fill: '#F97316', // Orange
      isPositive: false,
      displayValue: totalCommitments
    },
    {
      name: 'Actuals',
      value: -totalActuals,
      fill: '#A855F7', // Purple
      isPositive: false,
      displayValue: totalActuals
    },
    {
      name: 'Variance',
      value: variance,
      fill: variance >= 0 ? '#22C55E' : '#EF4444', // Green or Red
      isPositive: variance >= 0,
      displayValue: Math.abs(variance)
    }
  ]

  // For waterfall effect, calculate running totals
  let runningTotal = totalBudget
  const waterfallData = data.map((item, index) => {
    if (index === 0) {
      return {
        ...item,
        start: 0,
        end: totalBudget
      }
    }
    
    const prevTotal = runningTotal
    if (index === data.length - 1) {
      // Last bar shows the final variance
      return {
        ...item,
        start: 0,
        end: variance >= 0 ? variance : -variance
      }
    }
    
    runningTotal += item.value
    return {
      ...item,
      start: runningTotal,
      end: prevTotal
    }
  })

  // Format Y-axis values
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toString()
  }

  return (
    <div 
      className={`w-full ${className}`} 
      data-testid={testId}
    >
      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
        <span>Budget Variance Breakdown</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          variance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {variance >= 0 ? 'Under Budget' : 'Over Budget'}
        </span>
      </h4>
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={waterfallData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis 
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
          />
          <Tooltip content={<CustomTooltip currency={currency} />} />
          <ReferenceLine y={0} stroke="#9CA3AF" />
          <Bar dataKey="end" stackId="a" fill="transparent" />
          <Bar dataKey="value" stackId="a">
            {waterfallData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-blue-500 rounded" />
          <span className="text-gray-600">Budget</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-orange-500 rounded" />
          <span className="text-gray-600">Commitments</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-purple-500 rounded" />
          <span className="text-gray-600">Actuals</span>
        </div>
        <div className="flex items-center gap-1">
          <span className={`w-3 h-3 ${variance >= 0 ? 'bg-green-500' : 'bg-red-500'} rounded`} />
          <span className="text-gray-600">Variance</span>
        </div>
      </div>
    </div>
  )
}

export default VarianceWaterfall