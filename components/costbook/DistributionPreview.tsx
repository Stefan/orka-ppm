'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { DistributionResult } from '@/lib/costbook/distribution-engine'
import { formatCurrency } from '@/lib/currency-utils'
import { Currency } from '@/types/costbook'

export interface DistributionPreviewProps {
  distribution: DistributionResult
  currency: Currency
  className?: string
}

/**
 * DistributionPreview Component
 * Displays a visual preview of the calculated distribution
 */
export function DistributionPreview({
  distribution,
  currency,
  className = ''
}: DistributionPreviewProps) {
  if (distribution.error) {
    return (
      <div className={`bg-red-50 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
        <p className="text-red-800 dark:text-red-300 font-medium">Distribution Error</p>
        <p className="text-red-600 dark:text-red-400 text-sm mt-1">{distribution.error}</p>
      </div>
    )
  }

  if (distribution.periods.length === 0) {
    return (
      <div className={`bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-lg p-4 ${className}`}>
        <p className="text-gray-600 dark:text-slate-400 text-sm">No distribution calculated</p>
      </div>
    )
  }

  // Prepare chart data
  const chartData = distribution.periods.map(period => ({
    name: period.label,
    amount: period.amount,
    percentage: period.percentage
  }))

  // Color scale based on amount
  const maxAmount = Math.max(...distribution.periods.map(p => p.amount))
  const getBarColor = (amount: number) => {
    const intensity = amount / maxAmount
    if (intensity > 0.8) return '#ef4444' // red-500
    if (intensity > 0.6) return '#f59e0b' // amber-500
    if (intensity > 0.4) return '#3b82f6' // blue-500
    return '#10b981' // green-500
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-700 font-medium">Total Budget</p>
            <p className="text-2xl font-bold text-blue-900">
              {formatCurrency(distribution.total, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-700 font-medium">Distribution Profile</p>
            <p className="text-lg font-semibold text-blue-900 capitalize">
              {distribution.profile.replace('_', ' ')}
            </p>
            {distribution.confidence && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Confidence: {(distribution.confidence * 100).toFixed(0)}%
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">
          Distribution Over Time ({distribution.periods.length} periods)
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip 
              formatter={(value: number) => [
                formatCurrency(value, currency),
                'Amount'
              ]}
              labelStyle={{ color: '#374151' }}
            />
            <Legend />
            <Bar 
              dataKey="amount" 
              name="Budget Amount"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.amount)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Percentage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Date Range
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {distribution.periods.map((period, idx) => (
                <tr 
                  key={period.id}
                  className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-gray-50 dark:bg-slate-800/50'}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">
                    {period.label}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-slate-100 font-mono">
                    {formatCurrency(period.amount, currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-slate-400">
                    {period.percentage.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400">
                    {formatDateShort(period.start_date)} - {formatDateShort(period.end_date)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 dark:bg-slate-700">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-slate-100">
                  Total
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-slate-100 font-mono">
                  {formatCurrency(distribution.total, currency)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-slate-100">
                  100.00%
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}
