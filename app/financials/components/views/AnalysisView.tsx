
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer 
} from 'recharts'
import { BudgetPerformanceMetrics, CostAnalysis, AnalyticsData } from '../../types'

interface AnalysisViewProps {
  budgetPerformance: BudgetPerformanceMetrics | null
  costAnalysis: CostAnalysis[]
  analyticsData: AnalyticsData | null
  selectedCurrency: string
}

export default function AnalysisView({ 
  budgetPerformance, 
  costAnalysis, 
  analyticsData, 
  selectedCurrency 
}: AnalysisViewProps) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'down': return <TrendingDown className="h-4 w-4 text-green-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-red-600'
      case 'down': return 'text-green-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      {/* Budget Performance Overview */}
      {budgetPerformance && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Performance Overview</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{budgetPerformance.on_track_projects}</div>
              <div className="text-sm text-gray-600">On Track Projects</div>
              <div className="text-xs text-gray-500">Within 5% variance</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{budgetPerformance.at_risk_projects}</div>
              <div className="text-sm text-gray-600">At Risk Projects</div>
              <div className="text-xs text-gray-500">5-15% over budget</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{budgetPerformance.over_budget_projects}</div>
              <div className="text-sm text-gray-600">Over Budget Projects</div>
              <div className="text-xs text-gray-500">More than 15% over</div>
            </div>
          </div>

          {/* Savings vs Overruns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-green-800 mb-2">Total Savings</h4>
              <div className="text-2xl font-bold text-green-600">
                {budgetPerformance.total_savings.toLocaleString()} {selectedCurrency}
              </div>
              <div className="text-sm text-green-700">From under-budget projects</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-red-800 mb-2">Total Overruns</h4>
              <div className="text-2xl font-bold text-red-600">
                {budgetPerformance.total_overruns.toLocaleString()} {selectedCurrency}
              </div>
              <div className="text-sm text-red-700">From over-budget projects</div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Analysis by Category */}
      {costAnalysis.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Analysis by Category</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Trends Chart */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Monthly Cost Trends</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={costAnalysis}>
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
                  <Bar dataKey="previous_month" fill="#94A3B8" name="Previous Month" />
                  <Bar dataKey="current_month" fill="#3B82F6" name="Current Month" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cost Analysis Table */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Category Performance</h4>
              <div className="space-y-3">
                {costAnalysis.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{item.category}</div>
                      <div className="text-sm text-gray-600">
                        {item.current_month.toLocaleString()} {selectedCurrency}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getTrendIcon(item.trend)}
                      <span className={`font-medium ${getTrendColor(item.trend)}`}>
                        {item.percentage_change >= 0 ? '+' : ''}{item.percentage_change.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Project Efficiency Analysis */}
      {analyticsData && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Efficiency Analysis</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{analyticsData.avgEfficiency.toFixed(1)}%</div>
              <div className="text-sm text-blue-700">Average Efficiency</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{analyticsData.totalSavings.toLocaleString()}</div>
              <div className="text-sm text-green-700">Total Savings ({selectedCurrency})</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{analyticsData.totalOverruns.toLocaleString()}</div>
              <div className="text-sm text-red-700">Total Overruns ({selectedCurrency})</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}