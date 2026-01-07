'use client'

import React from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

interface Project {
  id: string
  name: string
  status: string
  health: 'green' | 'yellow' | 'red'
  budget?: number | null
  actual_cost?: number | null
}

interface PortfolioMetrics {
  health_distribution: { green: number; yellow: number; red: number }
}

interface DashboardChartsProps {
  projects: Project[]
  portfolioMetrics: PortfolioMetrics | null
  session: any
}

export default function DashboardCharts({ projects, portfolioMetrics }: DashboardChartsProps) {
  // Chart data preparation
  const healthChartData = portfolioMetrics?.health_distribution ? [
    { name: 'Healthy', value: portfolioMetrics.health_distribution.green || 0, color: '#10B981' },
    { name: 'At Risk', value: portfolioMetrics.health_distribution.yellow || 0, color: '#F59E0B' },
    { name: 'Critical', value: portfolioMetrics.health_distribution.red || 0, color: '#EF4444' }
  ] : []

  const statusChartData = projects.length > 0 ? (() => {
    const statusCounts = projects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' '),
      value: count,
      color: status === 'completed' ? '#10B981' : 
             status === 'active' ? '#3B82F6' :
             status === 'on-hold' ? '#F59E0B' :
             status === 'cancelled' ? '#EF4444' : '#6B7280'
    }))
  })() : []

  const budgetChartData = projects
    .filter(p => p.budget && p.actual_cost !== undefined)
    .slice(0, 10) // Limit to 10 projects for performance
    .map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      budget: p.budget || 0,
      actual: p.actual_cost || 0,
      variance: (p.actual_cost || 0) - (p.budget || 0)
    }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Project Health Distribution */}
      {healthChartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Health Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={healthChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {healthChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Project Status Distribution */}
      {statusChartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusChartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Budget vs Actual Spending */}
      {budgetChartData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual Spending (Top 10)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={budgetChartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  typeof value === 'number' ? `${value.toLocaleString()}` : value,
                  name === 'budget' ? 'Budget' : name === 'actual' ? 'Actual' : 'Variance'
                ]}
              />
              <Legend />
              <Bar dataKey="budget" fill="#10B981" name="Budget" />
              <Bar dataKey="actual" fill="#3B82F6" name="Actual" />
              <Bar dataKey="variance" fill="#EF4444" name="Variance" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}