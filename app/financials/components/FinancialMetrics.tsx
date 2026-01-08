
import { DollarSign, TrendingUp, TrendingDown, Target } from 'lucide-react'
import { FinancialMetrics } from '../types'

interface FinancialMetricsProps {
  metrics: FinancialMetrics
  selectedCurrency: string
}

export default function FinancialMetricsComponent({ metrics, selectedCurrency }: FinancialMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Budget</p>
            <p className="text-2xl font-bold text-blue-600">
              {metrics.total_budget.toLocaleString()} {selectedCurrency}
            </p>
          </div>
          <DollarSign className="h-8 w-8 text-blue-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Total Spent</p>
            <p className="text-2xl font-bold text-purple-600">
              {metrics.total_actual.toLocaleString()} {selectedCurrency}
            </p>
          </div>
          <Target className="h-8 w-8 text-purple-600" />
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Variance</p>
            <p className={`text-2xl font-bold ${metrics.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.variance_percentage >= 0 ? '+' : ''}{metrics.variance_percentage.toFixed(1)}%
            </p>
          </div>
          {metrics.variance_percentage >= 0 ? 
            <TrendingUp className="h-8 w-8 text-red-600" /> : 
            <TrendingDown className="h-8 w-8 text-green-600" />
          }
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Avg. Utilization</p>
            <p className="text-2xl font-bold text-orange-600">
              {metrics.average_budget_utilization.toFixed(1)}%
            </p>
          </div>
          <Target className="h-8 w-8 text-orange-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Over Budget</p>
            <p className="text-2xl font-bold text-red-600">
              {metrics.projects_over_budget}
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-red-600" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Under Budget</p>
            <p className="text-2xl font-bold text-green-600">
              {metrics.projects_under_budget}
            </p>
          </div>
          <TrendingDown className="h-8 w-8 text-green-600" />
        </div>
      </div>
    </div>
  )
}