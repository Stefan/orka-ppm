/**
 * Demo component to showcase skeleton loaders
 * This file is for development/testing purposes only
 * 
 * Usage: Import and render this component to see all skeleton loaders
 */

'use client'

import ChartSkeleton from './ChartSkeleton'
import TableSkeleton from './TableSkeleton'
import StatsSkeleton from './StatsSkeleton'

export default function SkeletonLoadersDemo() {
  return (
    <div className="p-8 space-y-6 bg-gray-50 dark:bg-slate-800/50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
          Admin Performance Skeleton Loaders
        </h1>
        <p className="text-gray-600 dark:text-slate-400 mb-8">
          These skeleton loaders maintain fixed dimensions to prevent Cumulative Layout Shift (CLS)
          and use GPU-accelerated animations for optimal performance.
        </p>
      </div>

      {/* Chart Skeletons */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Chart Skeletons</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </section>

      {/* Table Skeleton */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Table Skeleton</h2>
        <TableSkeleton />
      </section>

      {/* Stats Skeleton */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Stats Skeleton</h2>
        <StatsSkeleton />
      </section>

      {/* Technical Details */}
      <section className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Technical Details</h2>
        <ul className="space-y-2 text-gray-700 dark:text-slate-300">
          <li>
            <strong>ChartSkeleton:</strong> Fixed 300px height matching ResponsiveContainer dimensions
          </li>
          <li>
            <strong>TableSkeleton:</strong> 5 rows matching typical slow queries display
          </li>
          <li>
            <strong>StatsSkeleton:</strong> 3-column grid matching cache statistics layout
          </li>
          <li>
            <strong>Animation:</strong> GPU-accelerated pulse using transform and opacity only
          </li>
          <li>
            <strong>Performance:</strong> No layout recalculations during animation
          </li>
          <li>
            <strong>CLS Prevention:</strong> Fixed dimensions prevent layout shifts
          </li>
        </ul>
      </section>
    </div>
  )
}
