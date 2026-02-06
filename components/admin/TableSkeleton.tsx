/**
 * TableSkeleton Component
 * 
 * Displays a loading skeleton for the slow queries table with fixed dimensions
 * to prevent Cumulative Layout Shift (CLS) during lazy loading.
 * 
 * Dimensions: Matches the slow queries table structure with header and 5 rows
 * Animation: Uses transform and opacity for GPU-accelerated pulse effect
 * 
 * Requirements: 2.1, 2.2, 7.3
 */

export default function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
      {/* Table title skeleton */}
      <div className="h-6 w-56 bg-gray-200 rounded mb-4 animate-pulse-transform" />
      
      {/* Table skeleton */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
          {/* Table header skeleton */}
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 w-1/2">
                <div className="h-4 w-20 bg-gray-300 rounded animate-pulse-transform" />
              </th>
              <th className="px-6 py-3 w-1/4">
                <div className="h-4 w-16 bg-gray-300 rounded animate-pulse-transform" />
              </th>
              <th className="px-6 py-3 w-1/4">
                <div className="h-4 w-12 bg-gray-300 rounded animate-pulse-transform" />
              </th>
            </tr>
          </thead>
          
          {/* Table body skeleton - 5 rows to match typical slow queries display */}
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
            {[...Array(5)].map((_, index) => (
              <tr key={index}>
                <td className="px-6 py-4">
                  <div className="h-8 bg-gray-100 dark:bg-slate-700 rounded animate-pulse-transform" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-5 w-16 bg-gray-100 dark:bg-slate-700 rounded animate-pulse-transform" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700 rounded animate-pulse-transform" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
