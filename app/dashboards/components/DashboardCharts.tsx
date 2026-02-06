'use client'

import { memo } from 'react'
// Selective Recharts imports - nur was benötigt wird
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { ContentReservoir } from '../../../components/ui/ContentReservoir'

interface DashboardChartsProps {
  projects: any[]
}

// Memoized um Re-Renders zu vermeiden
const DashboardCharts = memo(({ projects }: DashboardChartsProps) => {
  // Data transformation
  const chartData = projects.map(p => ({
    name: p.name,
    budget: p.budget,
    spent: p.spent
  }))

  const statusData = [
    { name: 'On Track', value: projects.filter(p => p.status === 'on_track').length },
    { name: 'At Risk', value: projects.filter(p => p.status === 'at_risk').length },
    { name: 'Delayed', value: projects.filter(p => p.status === 'delayed').length }
  ]

  const COLORS = ['#10B981', '#F59E0B', '#EF4444']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Budget Chart */}
      <ContentReservoir reserveHeight={400} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-slate-100">Budget Overview</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="budget" fill="#3B82F6" />
            <Bar dataKey="spent" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </ContentReservoir>

      {/* Status Distribution */}
      <ContentReservoir reserveHeight={400} className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-slate-100">Project Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {statusData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ContentReservoir>
    </div>
  )
})

DashboardCharts.displayName = 'DashboardCharts'

export default DashboardCharts
