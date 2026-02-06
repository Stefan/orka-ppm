/**
 * StatsSkeleton Component
 * 
 * Displays a loading skeleton for the cache statistics section with fixed dimensions
 * to prevent Cumulative Layout Shift (CLS) during lazy loading.
 * 
 * Dimensions: Matches the cache statistics card with 3-column grid layout
 * Animation: Uses transform and opacity for GPU-accelerated pulse effect
 * 
 * Requirements: 2.1, 2.2, 7.3
 */

export default function StatsSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      {/* Section title skeleton */}
      <div className="h-6 w-40 bg-gray-200 rounded mb-4 animate-pulse-transform" />
      
      {/* Stats grid skeleton - 3 columns to match cache statistics layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="text-center">
            {/* Stat value skeleton */}
            <div className="h-8 w-24 bg-gray-200 rounded mx-auto mb-2 animate-pulse-transform" />
            
            {/* Stat label skeleton */}
            <div className="h-4 w-20 bg-gray-100 dark:bg-slate-700 rounded mx-auto animate-pulse-transform" />
          </div>
        ))}
      </div>
    </div>
  )
}
