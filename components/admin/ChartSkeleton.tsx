/**
 * ChartSkeleton Component
 * 
 * Displays a loading skeleton for chart sections with fixed dimensions
 * to prevent Cumulative Layout Shift (CLS) during lazy loading.
 * 
 * Dimensions: 300px height to match ResponsiveContainer in actual charts
 * Animation: Uses transform and opacity for GPU-accelerated pulse effect
 * 
 * Requirements: 2.1, 2.2, 7.3
 */

export default function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      {/* Chart title skeleton */}
      <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse-transform" />
      
      {/* Chart area skeleton - Fixed 300px height to match actual chart */}
      <div className="w-full h-[300px] bg-gray-100 dark:bg-slate-700 rounded animate-pulse-transform" />
    </div>
  )
}
