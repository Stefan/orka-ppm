'use client'

import { useAuth } from '../providers/SupabaseAuthProvider'
import { useEffect, useState } from 'react'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ScatterChart, Scatter
} from 'recharts'
import AppLayout from '../../components/AppLayout'
import { 
  AlertTriangle, Shield, TrendingUp, Activity, 
  Clock, User, Calendar, Target 
} from 'lucide-react'

interface Risk {
  id: string
  project_id: string
  project_name?: string
  title: string
  description: string
  category: 'technical' | 'financial' | 'resource' | 'schedule' | 'external'
  probability: number
  impact: number
  risk_score: number
  status: 'identified' | 'analyzing' | 'mitigating' | 'closed'
  mitigation: string
  owner: string
  due_date: string
  created_at: string
  updated_at: string
}

interface RiskMetrics {
  total_risks: number
  high_risk_count: number
  medium_risk_count: number
  low_risk_count: number
  by_category: { [key: string]: number }
  by_status: { [key: string]: number }
  average_risk_score: number
}

export default function Risks() {
  const { session } = useAuth()
  const [risks, setRisks] = useState<Risk[]>([])
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) {
      fetchRisks()
    }
  }, [session])

  async function fetchRisks() {
    setLoading(true)
    setError(null)
    try {
      // Fetch projects first to get project names
      const projectsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      
      if (!projectsResponse.ok) throw new Error('Failed to fetch projects')
      const projects = await projectsResponse.json()
      
      // Create project lookup
      const projectLookup = projects.reduce((acc: any, project: any) => {
        acc[project.id] = project.name
        return acc
      }, {})
      
      // For now, create sample risk data since we don't have risks endpoint yet
      const sampleRisks: Risk[] = [
        {
          id: '1',
          project_id: projects[0]?.id || '1',
          project_name: projects[0]?.name || 'Sample Project',
          title: 'Technical Debt Accumulation',
          description: 'Increasing technical debt may slow down future development',
          category: 'technical',
          probability: 0.7,
          impact: 0.8,
          risk_score: 0.56,
          status: 'mitigating',
          mitigation: 'Allocate 20% of sprint capacity to technical debt reduction',
          owner: 'Tech Lead',
          due_date: '2025-02-15',
          created_at: '2025-01-01',
          updated_at: '2025-01-03'
        },
        {
          id: '2',
          project_id: projects[1]?.id || '2',
          project_name: projects[1]?.name || 'Another Project',
          title: 'Key Resource Unavailability',
          description: 'Senior developer may leave during critical phase',
          category: 'resource',
          probability: 0.4,
          impact: 0.9,
          risk_score: 0.36,
          status: 'identified',
          mitigation: 'Cross-train team members and document critical knowledge',
          owner: 'Project Manager',
          due_date: '2025-01-20',
          created_at: '2025-01-02',
          updated_at: '2025-01-03'
        },
        {
          id: '3',
          project_id: projects[0]?.id || '1',
          project_name: projects[0]?.name || 'Sample Project',
          title: 'Budget Overrun Risk',
          description: 'Current spending rate may exceed allocated budget',
          category: 'financial',
          probability: 0.6,
          impact: 0.7,
          risk_score: 0.42,
          status: 'analyzing',
          mitigation: 'Implement weekly budget reviews and cost controls',
          owner: 'Finance Manager',
          due_date: '2025-01-31',
          created_at: '2025-01-01',
          updated_at: '2025-01-03'
        },
        {
          id: '4',
          project_id: projects[2]?.id || '3',
          project_name: projects[2]?.name || 'Third Project',
          title: 'External Dependency Delay',
          description: 'Third-party API integration may be delayed',
          category: 'external',
          probability: 0.5,
          impact: 0.6,
          risk_score: 0.30,
          status: 'mitigating',
          mitigation: 'Develop fallback integration plan and alternative providers',
          owner: 'Integration Lead',
          due_date: '2025-02-01',
          created_at: '2025-01-02',
          updated_at: '2025-01-03'
        }
      ]
      
      setRisks(sampleRisks)
      
      // Calculate metrics
      const totalRisks = sampleRisks.length
      const highRisk = sampleRisks.filter(r => r.risk_score >= 0.5).length
      const mediumRisk = sampleRisks.filter(r => r.risk_score >= 0.3 && r.risk_score < 0.5).length
      const lowRisk = sampleRisks.filter(r => r.risk_score < 0.3).length
      
      const byCategory = sampleRisks.reduce((acc, risk) => {
        acc[risk.category] = (acc[risk.category] || 0) + 1
        return acc
      }, {} as { [key: string]: number })
      
      const byStatus = sampleRisks.reduce((acc, risk) => {
        acc[risk.status] = (acc[risk.status] || 0) + 1
        return acc
      }, {} as { [key: string]: number })
      
      const avgRiskScore = sampleRisks.reduce((sum, risk) => sum + risk.risk_score, 0) / totalRisks
      
      setMetrics({
        total_risks: totalRisks,
        high_risk_count: highRisk,
        medium_risk_count: mediumRisk,
        low_risk_count: lowRisk,
        by_category: byCategory,
        by_status: byStatus,
        average_risk_score: avgRiskScore
      })
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getRiskLevelColor = (score: number) => {
    if (score >= 0.5) return 'text-red-600'
    if (score >= 0.3) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getRiskLevelBg = (score: number) => {
    if (score >= 0.5) return 'bg-red-100 text-red-800'
    if (score >= 0.3) return 'bg-yellow-100 text-yellow-800'
    return 'bg-green-100 text-green-800'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'identified': return 'bg-blue-100 text-blue-800'
      case 'analyzing': return 'bg-purple-100 text-purple-800'
      case 'mitigating': return 'bg-orange-100 text-orange-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical': return <Activity className="h-4 w-4" />
      case 'financial': return <Target className="h-4 w-4" />
      case 'resource': return <User className="h-4 w-4" />
      case 'schedule': return <Clock className="h-4 w-4" />
      case 'external': return <TrendingUp className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  // Prepare chart data
  const categoryData = metrics ? Object.entries(metrics.by_category).map(([category, count]) => ({
    category: category.charAt(0).toUpperCase() + category.slice(1),
    count
  })) : []

  const statusData = metrics ? Object.entries(metrics.by_status).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1),
    count
  })) : []

  const riskScatterData = risks.map(risk => ({
    name: risk.title,
    probability: risk.probability * 100,
    impact: risk.impact * 100,
    riskScore: risk.risk_score
  }))

  const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6']

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
              <h3 className="text-sm font-medium text-red-800">Error loading risks</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Risk Management</h1>
          <p className="text-gray-600 mt-1">Portfolio risk assessment and mitigation tracking</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Risks</p>
                <p className="text-2xl font-bold text-blue-600">
                  {metrics?.total_risks || 0}
                </p>
              </div>
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Risk</p>
                <p className="text-2xl font-bold text-red-600">
                  {metrics?.high_risk_count || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Medium Risk</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {metrics?.medium_risk_count || 0}
                </p>
              </div>
              <Activity className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Risk Score</p>
                <p className={`text-2xl font-bold ${getRiskLevelColor(metrics?.average_risk_score || 0)}`}>
                  {((metrics?.average_risk_score || 0) * 100).toFixed(0)}%
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk by Category */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Risk by Status */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks by Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusData}>
                <XAxis dataKey="status" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Matrix */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Matrix (Probability vs Impact)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={riskScatterData}>
              <XAxis 
                type="number" 
                dataKey="probability" 
                name="Probability" 
                unit="%" 
                domain={[0, 100]}
              />
              <YAxis 
                type="number" 
                dataKey="impact" 
                name="Impact" 
                unit="%" 
                domain={[0, 100]}
              />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => [
                  `${value}%`,
                  name === 'probability' ? 'Probability' : 'Impact'
                ]}
              />
              <Scatter dataKey="impact" fill="#EF4444" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Details Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Risk Register</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {risks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{risk.title}</div>
                        <div className="text-sm text-gray-500 mt-1">{risk.description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {risk.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getCategoryIcon(risk.category)}
                        <span className="ml-2 text-sm text-gray-900 capitalize">
                          {risk.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelBg(risk.risk_score)}`}>
                        {(risk.risk_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(risk.status)}`}>
                        {risk.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {risk.owner}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                        {new Date(risk.due_date).toLocaleDateString()}
                      </div>
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