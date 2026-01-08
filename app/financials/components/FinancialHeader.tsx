
import { AlertTriangle, Filter, Download, RefreshCw } from 'lucide-react'
import { FinancialMetrics, AnalyticsData } from '../types'

interface FinancialHeaderProps {
  metrics: FinancialMetrics | null
  analyticsData: AnalyticsData | null
  selectedCurrency: string
  showFilters: boolean
  onCurrencyChange: (currency: string) => void
  onExport: () => void
  onRefresh: () => void
  onToggleFilters: () => void
}

export default function FinancialHeader({
  metrics,
  analyticsData,
  selectedCurrency,
  showFilters,
  onCurrencyChange,
  onExport,
  onRefresh,
  onToggleFilters
}: FinancialHeaderProps) {
  return (
    <div className="flex justify-between items-start">
      <div>
        <div className="flex items-center space-x-4">
          <h1 className="text-3xl font-bold text-gray-900">Financial Management</h1>
          {analyticsData && analyticsData.criticalAlerts > 0 && (
            <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {analyticsData.criticalAlerts} Critical Alert{analyticsData.criticalAlerts !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
          {metrics && (
            <>
              <span>Total Budget: {metrics.total_budget.toLocaleString()} {selectedCurrency}</span>
              <span>Variance: {metrics.variance_percentage.toFixed(1)}%</span>
              <span>{analyticsData?.totalProjects} projects tracked</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <select
          value={selectedCurrency}
          onChange={(e) => onCurrencyChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
        >
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
        
        <button
          onClick={onExport}
          className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </button>
        
        <button
          onClick={onRefresh}
          className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
        
        <button
          onClick={onToggleFilters}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </button>
      </div>
    </div>
  )
}