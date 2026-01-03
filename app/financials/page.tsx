'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useEffect, useState } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import AppLayout from '../../components/AppLayout'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Calculator } from 'lucide-react'

interface FinancialData {
  project_id: string
  project_name: string
  budget: number
  actual_cost: number
  variance: number
  variance_percentage: number
  status: 'under_budget' | 'on_budget' | 'over_budget'
}

interface PortfolioFinancials {
  total_budget: number
  total_actual: number
  total_variance: number
  variance_percentage: number
  projects: FinancialData[]
}

export default function Financials() {
  const { session } = useAuth()
  const [financialData, setFinancialData] = useState<PortfolioFinancials | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchFinancialData()
    }
  }, [session])

  async function fetchFinancialData() {
    setLoading(true)
    setError(null)
    try {
      // Fetch projects data and calculate financial metrics
      const projectsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!projectsResponse.ok) throw new Error('Failed to fetch projects')
      const projects = await projectsResponse.json()
      
      // Calculate financial data
      const projectFinancials: FinancialData[] = projects.map((project: any) => {
        const budget = project.budget || 0
        const actual = project.actual_cost || 0
        const variance = actual - budget
        const variancePercentage = budget > 0 ? (variance / budget) * 100 : 0
        
        let status: 'under_budget' | 'on_budget' | 'over_budget' = 'on_budget'
        if (variancePercentage > 10) status = 'over_budget'
        else if (variancePercentage < -10) status = 'under_budget'
        
        return {
          project_id: project.id,
          project_name: project.name,
          budget,
          actual_cost: actual,
          variance,
          variance_percentage: variancePercentage,
          status
        }
      })
      
      // Calculate portfolio totals
      const totalBudget = projectFinancials.reduce((sum, p) => sum + p.budget, 0)
      const totalActual = projectFinancials.reduce((sum, p) => sum + p.actual_cost, 0)
      const totalVariance = totalActual - totalBudget
      const portfolioVariancePercentage = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0
      
      setFinancialData({
        total_budget: totalBudget,
        total_actual: totalActual,
        total_variance: totalVariance,
        variance_percentage: portfolioVariancePercentage,
        projects: projectFinancials
      })
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return 'text-red-600'
    if (variance < 0) return 'text-green-600'
    return 'text-gray-600'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'under_budget': return 'bg-green-100 text-green-800'
      case 'over_budget': return 'bg-red-100 text-red-800'
      default: return 'bg-blue-100 text-blue-800'
    }
  }

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    </AppLayout>
  )

  if (error) return (
    <AppLayout>
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading financials</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  if (!financialData) return (
    <AppLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900">Financial Overview</h1>
        <p className="text-gray-600 mt-2">No financial data available</p>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Financial Overview</h1>
          <p className="text-gray-600 mt-1">Portfolio budget tracking and variance analysis</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${financialData.total_budget.toLocaleString()}
                </p>
              </div>
              <Calculator className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Actual</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${financialData.total_actual.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Variance</p>
                <p className={`text-2xl font-bold ${getVarianceColor(financialData.total_variance)}`}>
                  ${Math.abs(financialData.total_variance).toLocaleString()}
                </p>
              </div>
              {financialData.total_variance >= 0 ? (
                <TrendingUp className="h-8 w-8 text-red-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-green-600" />
              )}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Variance %</p>
                <p className={`text-2xl font-bold ${getVarianceColor(financialData.total_variance)}`}>
                  {financialData.variance_percentage.toFixed(1)}%
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${
                Math.abs(financialData.variance_percentage) > 10 ? 'text-red-600' : 'text-green-600'
              }`} />
            </div>
          </div>
        </div>

        {/* Budget vs Actual Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget vs Actual by Project</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={financialData.projects}>
              <XAxis 
                dataKey="project_name" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
              />
              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `$${value.toLocaleString()}`,
                  name === 'budget' ? 'Budget' : 'Actual'
                ]}
              />
              <Legend />
              <Bar dataKey="budget" fill="#3B82F6" name="Budget" />
              <Bar dataKey="actual_cost" fill="#EF4444" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Project Financial Details Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Project Financial Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Variance %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {financialData.projects.map((project) => (
                  <tr key={project.project_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{project.project_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${project.budget.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${project.actual_cost.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getVarianceColor(project.variance)}`}>
                      {project.variance >= 0 ? '+' : ''}${project.variance.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getVarianceColor(project.variance)}`}>
                      {project.variance >= 0 ? '+' : ''}{project.variance_percentage.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                        {project.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}