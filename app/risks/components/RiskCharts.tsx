'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart, Area } from 'recharts'

interface RiskChartsProps {
  viewMode: 'overview' | 'matrix' | 'trends' | 'detailed'
  categoryData: Array<{
    category: string
    count: number
    high_risk: number
    medium_risk: number
    low_risk: number
  }>
  statusData: Array<{
    status: string
    count: number
  }>
  riskScatterData: Array<{
    name: string
    probability: number
    impact: number
    riskScore: number
    category: string
  }>
  trendData?: Array<{
    date: string
    total: number
    high: number
    medium: number
    low: number
  }>
  COLORS: string[]
  RISK_COLORS: {
    technical: string
    financial: string
    resource: string
    schedule: string
    external: string
  }
}

const RiskCharts = React.memo(function RiskCharts({
  viewMode,
  categoryData,
  statusData,
  riskScatterData,
  trendData,
  COLORS,
  RISK_COLORS
}: RiskChartsProps) {
  if (viewMode === 'overview') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk by Category */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Risks by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="high_risk" stackId="a" fill="#EF4444" name="High Risk" />
              <Bar dataKey="medium_risk" stackId="a" fill="#F59E0B" name="Medium Risk" />
              <Bar dataKey="low_risk" stackId="a" fill="#10B981" name="Low Risk" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Risk by Status */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Risks by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, count }) => `${status}: ${count}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {statusData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  if (viewMode === 'matrix') {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Risk Probability-Impact Matrix</h3>
        <ResponsiveContainer width="100%" height={500}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis 
              type="number" 
              dataKey="probability" 
              name="Probability" 
              unit="%" 
              domain={[0, 100]}
              label={{ value: 'Probability (%)', position: 'bottom' }}
            />
            <YAxis 
              type="number" 
              dataKey="impact" 
              name="Impact" 
              unit="%" 
              domain={[0, 100]}
              label={{ value: 'Impact (%)', angle: -90, position: 'left' }}
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter 
              name="Risks" 
              data={riskScatterData} 
              fill="#8884d8"
            >
              {riskScatterData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={RISK_COLORS[entry.category as keyof typeof RISK_COLORS] || '#8884d8'} 
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        
        {/* Matrix Legend */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: RISK_COLORS.technical }}></div>
            <span className="text-sm text-gray-700 dark:text-slate-300">Technical</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: RISK_COLORS.financial }}></div>
            <span className="text-sm text-gray-700 dark:text-slate-300">Financial</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: RISK_COLORS.resource }}></div>
            <span className="text-sm text-gray-700 dark:text-slate-300">Resource</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: RISK_COLORS.schedule }}></div>
            <span className="text-sm text-gray-700 dark:text-slate-300">Schedule</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: RISK_COLORS.external }}></div>
            <span className="text-sm text-gray-700 dark:text-slate-300">External</span>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'trends' && trendData) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Risk Trends Over Time</h3>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={trendData}>
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="high" 
              stackId="1" 
              stroke="#EF4444" 
              fill="#EF4444" 
              name="High Risk"
            />
            <Area 
              type="monotone" 
              dataKey="medium" 
              stackId="1" 
              stroke="#F59E0B" 
              fill="#F59E0B" 
              name="Medium Risk"
            />
            <Area 
              type="monotone" 
              dataKey="low" 
              stackId="1" 
              stroke="#10B981" 
              fill="#10B981" 
              name="Low Risk"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return null
})

export default RiskCharts
