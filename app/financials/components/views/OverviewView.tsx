
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart
} from 'recharts'
import { AnalyticsData } from '../../types'

interface OverviewViewProps {
  analyticsData: AnalyticsData
  selectedCurrency: string
}

export default function OverviewView({ analyticsData, selectedCurrency }: OverviewViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Enhanced Budget Status Distribution */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Budget Status Distribution</h3>
          <span className="text-sm text-gray-500">{analyticsData.totalProjects} projects</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analyticsData.budgetStatusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value, percent }: any) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {analyticsData.budgetStatusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Enhanced Category Spending Analysis */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Category Spending</h3>
          <span className="text-sm text-gray-500">Planned vs Actual</span>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analyticsData.categoryData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number | undefined) => `${(value || 0).toLocaleString()} ${selectedCurrency}`} />
            <Legend />
            <Bar dataKey="planned" fill="#3B82F6" name="Planned" />
            <Bar dataKey="actual" fill="#EF4444" name="Actual" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Enhanced Project Performance with Efficiency Scores */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Project Performance Overview</h3>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>Avg Efficiency: {analyticsData.avgEfficiency.toFixed(1)}%</span>
            <span>Net Variance: {analyticsData.netVariance >= 0 ? '+' : ''}{analyticsData.netVariance.toLocaleString()} {selectedCurrency}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={analyticsData.projectPerformanceData.slice(0, 10)}>
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              formatter={(value: number | undefined, name: string | undefined) => {
                const safeValue = value || 0
                const safeName = name || ''
                if (safeName === 'Efficiency Score') return [`${safeValue.toFixed(1)}%`, safeName]
                return [`${safeValue.toLocaleString()} ${selectedCurrency}`, safeName]
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="budget" fill="#3B82F6" name="Budget" />
            <Bar yAxisId="left" dataKey="actual" fill="#EF4444" name="Actual" />
            <Bar yAxisId="right" dataKey="efficiency_score" fill="#10B981" name="Efficiency Score" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}