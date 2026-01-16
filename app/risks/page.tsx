'use client'

import { useEffect, useState, useMemo, useDeferredValue, useReducer, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../providers/SupabaseAuthProvider'
import AppLayout from '../../components/shared/AppLayout'
import { AlertTriangle, Shield, TrendingUp, Activity, Clock, User, Calendar, Target, Filter, Download, RefreshCw, BarChart3, Plus, Search, SortAsc, SortDesc, Zap } from 'lucide-react'
import { getApiUrl } from '../../lib/api/client'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '../../components/ui/skeletons'
import { useDebounce } from '../../hooks/useDebounce'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ScatterChart, Scatter, AreaChart, Area } from 'recharts'

// Dynamic imports for heavy components (code splitting)
const AIRiskManagement = dynamic(() => import('../../components/ai/AIRiskManagement'), {
  loading: () => <SkeletonCard variant="stat" />,
  ssr: false
})

const RiskCharts = dynamic(() => import('./components/RiskCharts'), {
  loading: () => <SkeletonChart variant="bar" height="h-80" />,
  ssr: false
})

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
  trend_data: Array<{
    date: string
    total: number
    high: number
    medium: number
    low: number
  }>
}

interface RiskAlert {
  risk_id: string
  risk_title: string
  project_name: string
  alert_type: 'new_high_risk' | 'escalated' | 'overdue_mitigation'
  message: string
  created_at: string
}

// Reducer for batching filter and sort state updates
interface FilterSortState {
  filterCategory: string
  filterStatus: string
  sortBy: 'risk_score' | 'created_at' | 'due_date'
  sortOrder: 'asc' | 'desc'
}

type FilterSortAction =
  | { type: 'SET_FILTER_CATEGORY'; value: string }
  | { type: 'SET_FILTER_STATUS'; value: string }
  | { type: 'SET_SORT_BY'; value: 'risk_score' | 'created_at' | 'due_date' }
  | { type: 'TOGGLE_SORT_ORDER' }
  | { type: 'RESET_FILTERS' }

function filterSortReducer(state: FilterSortState, action: FilterSortAction): FilterSortState {
  switch (action.type) {
    case 'SET_FILTER_CATEGORY':
      return { ...state, filterCategory: action.value }
    case 'SET_FILTER_STATUS':
      return { ...state, filterStatus: action.value }
    case 'SET_SORT_BY':
      return { ...state, sortBy: action.value }
    case 'TOGGLE_SORT_ORDER':
      return { ...state, sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' }
    case 'RESET_FILTERS':
      return {
        filterCategory: 'all',
        filterStatus: 'all',
        sortBy: 'risk_score',
        sortOrder: 'desc'
      }
    default:
      return state
  }
}

export default function Risks() {
  const { session } = useAuth()
  const [risks, setRisks] = useState<Risk[]>([])
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null)
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'matrix' | 'trends' | 'detailed'>('overview')
  
  // Use reducer for batching filter and sort state updates
  const [filterSortState, dispatchFilterSort] = useReducer(filterSortReducer, {
    filterCategory: 'all',
    filterStatus: 'all',
    sortBy: 'risk_score',
    sortOrder: 'desc'
  })
  
  const { filterCategory, filterStatus, sortBy, sortOrder } = filterSortState
  
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showMonteCarloModal, setShowMonteCarloModal] = useState(false)
  const [showAIAnalysis, setShowAIAnalysis] = useState(true)

  // Debounce search term to reduce update frequency (300ms delay)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Defer filter changes for non-critical updates (charts, analytics)
  const deferredFilterCategory = useDeferredValue(filterCategory)
  const deferredFilterStatus = useDeferredValue(filterStatus)

  // Enhanced analytics data
  const analyticsData = useMemo(() => {
    if (!metrics || !risks.length) return null

    const riskTrendData = metrics.trend_data || []
    
    // Use deferred filter values for analytics to prioritize critical UI updates
    const categoryRiskData = Object.entries(metrics.by_category).map(([category, count]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      count,
      high_risk: risks.filter(r => r.category === category && r.risk_score >= 0.5).length,
      medium_risk: risks.filter(r => r.category === category && r.risk_score >= 0.3 && r.risk_score < 0.5).length,
      low_risk: risks.filter(r => r.category === category && r.risk_score < 0.3).length
    }))

    const riskMatrixData = risks.map(risk => ({
      name: risk.title.substring(0, 20) + '...',
      probability: risk.probability * 100,
      impact: risk.impact * 100,
      riskScore: risk.risk_score,
      category: risk.category,
      status: risk.status
    }))

    const statusDistribution = Object.entries(metrics.by_status).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      value: count,
      percentage: (count / metrics.total_risks * 100).toFixed(1)
    }))

    const topRisks = [...risks]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 5)
      .map(risk => ({
        ...risk,
        project_name: risk.project_name || 'Unknown Project'
      }))

    return {
      categoryRiskData,
      riskMatrixData,
      statusDistribution,
      topRisks,
      riskTrendData,
      totalRisks: metrics.total_risks,
      criticalRisks: metrics.high_risk_count,
      avgRiskScore: metrics.average_risk_score
    }
  }, [metrics, risks, deferredFilterCategory, deferredFilterStatus])

  // Filtered and sorted risks
  const filteredRisks = useMemo(() => {
    const filtered = risks.filter(risk => {
      const matchesCategory = filterCategory === 'all' || risk.category === filterCategory
      const matchesStatus = filterStatus === 'all' || risk.status === filterStatus
      const matchesSearch = debouncedSearchTerm === '' || 
        risk.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        risk.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        risk.project_name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      
      return matchesCategory && matchesStatus && matchesSearch
    })

    filtered.sort((a, b) => {
      let aValue, bValue
      switch (sortBy) {
        case 'risk_score':
          aValue = a.risk_score
          bValue = b.risk_score
          break
        case 'created_at':
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
        case 'due_date':
          aValue = new Date(a.due_date).getTime()
          bValue = new Date(b.due_date).getTime()
          break
        default:
          return 0
      }
      
      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue
    })

    return filtered
  }, [risks, filterCategory, filterStatus, debouncedSearchTerm, sortBy, sortOrder])

  useEffect(() => {
    if (session) {
      fetchRisks()
    }
  }, [session])

  async function fetchRisks() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchProjects(),
        fetchRiskAlerts()
      ])
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function createRisk(riskData: {
    project_id: string
    title: string
    description?: string
    category: 'technical' | 'financial' | 'resource' | 'schedule' | 'external'
    probability: number
    impact: number
    mitigation?: string
    owner_id?: string
    due_date?: string
  }) {
    if (!session?.access_token) throw new Error('Not authenticated')
    
    try {
      const response = await fetch(getApiUrl('/risks/'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(riskData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Failed to create risk: ${response.status}`)
      }
      
      const newRisk = await response.json()
      setRisks(prev => [...prev, newRisk])
      setShowAddModal(false)
      return newRisk
    } catch (error: unknown) {
      console.error('Error creating risk:', error)
      throw error instanceof Error ? error : new Error('Unknown error creating risk')
    }
  }

  async function fetchProjects() {
    if (!session?.access_token) return
    
    try {
      // Fetch projects first to get project names
      const projectsResponse = await fetch(getApiUrl('/projects/'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
      })
      
      if (!projectsResponse.ok) throw new Error('Failed to fetch projects')
      const projectsData = await projectsResponse.json()
      
      // Extract projects array from response
      const projects = Array.isArray(projectsData) ? projectsData : (projectsData.projects || [])
    
    // Enhanced sample risk data with more realistic scenarios
    const sampleRisks: Risk[] = [
      {
        id: '1',
        project_id: projects[0]?.id || '1',
        project_name: projects[0]?.name || 'Sample Project',
        title: 'Technical Debt Accumulation',
        description: 'Increasing technical debt may slow down future development and increase maintenance costs',
        category: 'technical',
        probability: 0.7,
        impact: 0.8,
        risk_score: 0.56,
        status: 'mitigating',
        mitigation: 'Allocate 20% of sprint capacity to technical debt reduction and implement code review standards',
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
        description: 'Senior developer may leave during critical phase, impacting delivery timeline',
        category: 'resource',
        probability: 0.4,
        impact: 0.9,
        risk_score: 0.36,
        status: 'identified',
        mitigation: 'Cross-train team members, document critical knowledge, and prepare succession plan',
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
        description: 'Current spending rate may exceed allocated budget by 15-20%',
        category: 'financial',
        probability: 0.6,
        impact: 0.7,
        risk_score: 0.42,
        status: 'analyzing',
        mitigation: 'Implement weekly budget reviews, cost controls, and scope prioritization',
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
        description: 'Third-party API integration may be delayed due to vendor issues',
        category: 'external',
        probability: 0.5,
        impact: 0.6,
        risk_score: 0.30,
        status: 'mitigating',
        mitigation: 'Develop fallback integration plan and identify alternative providers',
        owner: 'Integration Lead',
        due_date: '2025-02-01',
        created_at: '2025-01-02',
        updated_at: '2025-01-03'
      },
      {
        id: '5',
        project_id: projects[1]?.id || '2',
        project_name: projects[1]?.name || 'Another Project',
        title: 'Schedule Compression Risk',
        description: 'Aggressive timeline may lead to quality issues and team burnout',
        category: 'schedule',
        probability: 0.8,
        impact: 0.6,
        risk_score: 0.48,
        status: 'identified',
        mitigation: 'Reassess timeline, prioritize features, and add buffer time for critical tasks',
        owner: 'Project Manager',
        due_date: '2025-01-25',
        created_at: '2025-01-03',
        updated_at: '2025-01-04'
      },
      {
        id: '6',
        project_id: projects[0]?.id || '1',
        project_name: projects[0]?.name || 'Sample Project',
        title: 'Security Vulnerability Risk',
        description: 'Potential security vulnerabilities in third-party dependencies',
        category: 'technical',
        probability: 0.3,
        impact: 0.9,
        risk_score: 0.27,
        status: 'analyzing',
        mitigation: 'Implement automated security scanning and regular dependency updates',
        owner: 'Security Lead',
        due_date: '2025-02-10',
        created_at: '2025-01-02',
        updated_at: '2025-01-04'
      }
    ]
    
    setRisks(sampleRisks)
    
    // Calculate enhanced metrics with trend data
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
    
    // Generate sample trend data
    const trendData = [
      { date: '2024-12-01', total: 4, high: 1, medium: 2, low: 1 },
      { date: '2024-12-15', total: 5, high: 2, medium: 2, low: 1 },
      { date: '2025-01-01', total: 6, high: 2, medium: 3, low: 1 },
      { date: '2025-01-04', total: totalRisks, high: highRisk, medium: mediumRisk, low: lowRisk }
    ]
    
    setMetrics({
      total_risks: totalRisks,
      high_risk_count: highRisk,
      medium_risk_count: mediumRisk,
      low_risk_count: lowRisk,
      by_category: byCategory,
      by_status: byStatus,
      average_risk_score: avgRiskScore,
      trend_data: trendData
    })
    } catch (error: unknown) {
      console.error('Error fetching projects:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch projects')
    }
  }

  async function fetchRiskAlerts() {
    // Sample risk alerts
    const sampleAlerts: RiskAlert[] = [
      {
        risk_id: '1',
        risk_title: 'Technical Debt Accumulation',
        project_name: 'Sample Project',
        alert_type: 'escalated',
        message: 'Risk score increased from 45% to 56% due to delayed refactoring',
        created_at: '2025-01-03'
      },
      {
        risk_id: '5',
        risk_title: 'Schedule Compression Risk',
        project_name: 'Another Project',
        alert_type: 'new_high_risk',
        message: 'New high-risk item identified with 48% risk score',
        created_at: '2025-01-04'
      }
    ]
    
    setAlerts(sampleAlerts)
  }

  const exportRiskData = () => {
    const exportData = {
      risks: filteredRisks,
      metrics,
      alerts,
      analytics: analyticsData,
      filters: { category: filterCategory, status: filterStatus, search: searchTerm },
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `risk-report-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
    count,
    high_risk: risks.filter(r => r.category === category && r.risk_score >= 0.5).length,
    medium_risk: risks.filter(r => r.category === category && r.risk_score >= 0.3 && r.risk_score < 0.5).length,
    low_risk: risks.filter(r => r.category === category && r.risk_score < 0.3).length
  })) : []

  const statusData = metrics ? Object.entries(metrics.by_status).map(([status, count]) => ({
    status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
    count
  })) : []

  const riskScatterData = risks.map(risk => ({
    name: risk.title,
    probability: risk.probability * 100,
    impact: risk.impact * 100,
    riskScore: risk.risk_score,
    category: risk.category
  }))

  const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6']
  const RISK_COLORS = {
    technical: '#3B82F6',
    financial: '#EF4444', 
    resource: '#F59E0B',
    schedule: '#10B981',
    external: '#8B5CF6'
  }

  if (loading) return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {/* Header Skeleton */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
        
        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </div>
        
        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart variant="bar" height="h-80" />
          <SkeletonChart variant="pie" height="h-80" />
        </div>
        
        {/* Top Risks Skeleton */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Risk Table Skeleton */}
        <SkeletonTable rows={8} columns={9} showHeader={true} />
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
        {/* Enhanced Mobile-First Header */}
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-col space-y-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Risk Management</h1>
                <div className="flex flex-wrap items-center gap-2">
                  {alerts.length > 0 && (
                    <div className="flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span>{alerts.length} Alert{alerts.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-sm text-gray-600">
                {metrics && (
                  <>
                    <span>Total: {metrics.total_risks}</span>
                    <span>High Risk: {metrics.high_risk_count}</span>
                    <span>Avg: {(metrics.average_risk_score * 100).toFixed(1)}%</span>
                    <span>{filteredRisks.length} filtered</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Mobile-Optimized Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setViewMode(
                  viewMode === 'overview' ? 'matrix' : 
                  viewMode === 'matrix' ? 'trends' : 
                  viewMode === 'trends' ? 'detailed' : 'overview'
                )}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-300 text-sm font-medium"
              >
                {viewMode === 'overview' ? <BarChart3 className="h-4 w-4 mr-2 flex-shrink-0" /> : 
                 viewMode === 'matrix' ? <Target className="h-4 w-4 mr-2 flex-shrink-0" /> : 
                 viewMode === 'trends' ? <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" /> :
                 <Activity className="h-4 w-4 mr-2 flex-shrink-0" />}
                <span className="hidden sm:inline">
                  {viewMode === 'overview' ? 'Matrix' : 
                   viewMode === 'matrix' ? 'Trends' : 
                   viewMode === 'trends' ? 'Detailed' : 'Overview'}
                </span>
              </button>
              
              <button
                onClick={() => setShowAIAnalysis(!showAIAnalysis)}
                className={`flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  showAIAnalysis 
                    ? 'bg-purple-600 text-white hover:bg-purple-700 active:bg-purple-800' 
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200 active:bg-purple-300'
                }`}
              >
                <Zap className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">AI Analysis</span>
                <span className="sm:hidden">AI</span>
              </button>
              
              <button
                onClick={() => setShowMonteCarloModal(true)}
                disabled={filteredRisks.length === 0}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 active:bg-purple-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Zap className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Monte Carlo</span>
                <span className="sm:hidden">MC</span>
              </button>
              
              <button
                onClick={exportRiskData}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 active:bg-green-300 text-sm font-medium"
              >
                <Download className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Export</span>
              </button>
              
              <button
                onClick={fetchRisks}
                className="flex items-center justify-center min-h-[44px] px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 active:bg-blue-300 text-sm font-medium"
              >
                <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center justify-center min-h-[44px] px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  showFilters 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800' 
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300'
                }`}
              >
                <Filter className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Risk Alerts */}
        {alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-900">Risk Alerts</h3>
              <span className="text-sm text-red-700">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{alert.risk_title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Project: {alert.project_name}</span>
                        <span>Date: {new Date(alert.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.alert_type === 'new_high_risk' ? 'bg-red-100 text-red-800' : 
                      alert.alert_type === 'escalated' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}
                    >
                      {alert.alert_type.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Mobile-First Filter Panel */}
        {showFilters && (
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search risks..."
                    className="input-field w-full min-h-[44px] pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => dispatchFilterSort({ type: 'SET_FILTER_CATEGORY', value: e.target.value })}
                  className="w-full min-h-[44px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                >
                  <option value="all">All Categories</option>
                  <option value="technical">Technical</option>
                  <option value="financial">Financial</option>
                  <option value="resource">Resource</option>
                  <option value="schedule">Schedule</option>
                  <option value="external">External</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => dispatchFilterSort({ type: 'SET_FILTER_STATUS', value: e.target.value })}
                  className="w-full min-h-[44px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                >
                  <option value="all">All Statuses</option>
                  <option value="identified">Identified</option>
                  <option value="analyzing">Analyzing</option>
                  <option value="mitigating">Mitigating</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => dispatchFilterSort({ type: 'SET_SORT_BY', value: e.target.value as any })}
                    className="flex-1 min-h-[44px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  >
                    <option value="risk_score">Risk Score</option>
                    <option value="created_at">Created Date</option>
                    <option value="due_date">Due Date</option>
                  </select>
                  <button
                    onClick={() => dispatchFilterSort({ type: 'TOGGLE_SORT_ORDER' })}
                    className="min-h-[44px] px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex items-end">
                <button 
                  onClick={() => {
                    dispatchFilterSort({ type: 'RESET_FILTERS' })
                    setSearchTerm('')
                  }}
                  className="w-full min-h-[44px] px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 active:bg-gray-300 font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile-First Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">Total Risks</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600">
                  {metrics?.total_risks || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {filteredRisks.length} filtered
                </p>
              </div>
              <Shield className="h-5 w-5 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">High Risk</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600">
                  {metrics?.high_risk_count || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics?.total_risks ? ((metrics.high_risk_count / metrics.total_risks) * 100).toFixed(1) : 0}% of total
                </p>
              </div>
              <AlertTriangle className="h-5 w-5 sm:h-8 sm:w-8 text-red-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">Medium Risk</p>
                <p className="text-lg sm:text-2xl font-bold text-yellow-600">
                  {metrics?.medium_risk_count || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Active mitigation
                </p>
              </div>
              <Activity className="h-5 w-5 sm:h-8 sm:w-8 text-yellow-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">Avg Risk Score</p>
                <p className={`text-lg sm:text-2xl font-bold ${getRiskLevelColor(metrics?.average_risk_score || 0)}`}>
                  {((metrics?.average_risk_score || 0) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Portfolio average
                </p>
              </div>
              <Target className="h-5 w-5 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* AI Risk Management System */}
        {showAIAnalysis && (
          <AIRiskManagement 
            risks={risks.map(risk => ({
              id: risk.id,
              title: risk.title,
              category: risk.category,
              risk_score: risk.risk_score,
              project_id: risk.project_id,
              project_name: risk.project_name || 'Unknown Project',
              status: risk.status,
              created_at: risk.created_at
            }))}
            onRiskUpdate={(riskId, updates) => {
              setRisks(prev => prev.map(risk => 
                risk.id === riskId ? { ...risk, ...updates } : risk
              ))
            }}
            onAlertGenerated={(alert) => {
              // Add alert to the alerts state if needed
              console.log('New AI alert generated:', alert)
            }}
          />
        )}

        {/* View Mode Content */}
        {viewMode === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enhanced Risk by Category */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Risks by Category</h3>
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

            {/* Risk Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }: any) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {statusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {viewMode === 'matrix' && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Matrix (Probability vs Impact)</h3>
            <ResponsiveContainer width="100%" height={500}>
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
                  labelFormatter={(label) => `Risk: ${label}`}
                />
                {Object.entries(RISK_COLORS).map(([category, color]) => (
                  <Scatter 
                    key={category}
                    dataKey="impact" 
                    fill={color}
                    data={riskScatterData.filter(d => d.category === category)}
                    name={category.charAt(0).toUpperCase() + category.slice(1)}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewMode === 'trends' && metrics?.trend_data && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Trends Over Time</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={metrics.trend_data}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="high" stackId="1" stroke="#EF4444" fill="#EF4444" name="High Risk" />
                <Area type="monotone" dataKey="medium" stackId="1" stroke="#F59E0B" fill="#F59E0B" name="Medium Risk" />
                <Area type="monotone" dataKey="low" stackId="1" stroke="#10B981" fill="#10B981" name="Low Risk" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Risks Summary */}
        {analyticsData?.topRisks && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Risks by Score</h3>
            <div className="space-y-3">
              {analyticsData.topRisks.map((risk, index) => (
                <div key={risk.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{risk.title}</h4>
                      <p className="text-sm text-gray-600">{risk.project_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(risk.category)}
                      <span className="text-sm text-gray-600 capitalize">{risk.category}</span>
                    </div>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getRiskLevelBg(risk.risk_score)}`}>
                      {(risk.risk_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Mobile-First Risk Details Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
            <h3 className="text-lg font-semibold text-gray-900">
              Risk Register ({filteredRisks.length} risks)
            </h3>
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium"
            >
              <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
              Add Risk
            </button>
          </div>
          
          {/* Mobile-optimized table with horizontal scroll */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Risk Score
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Probability
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impact
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRisks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{risk.title}</div>
                        <div className="text-sm text-gray-500 mt-1 max-w-xs truncate">{risk.description}</div>
                        {risk.mitigation && (
                          <div className="text-xs text-blue-600 mt-1 max-w-xs truncate">
                            Mitigation: {risk.mitigation}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {risk.project_name}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getCategoryIcon(risk.category)}
                        <span className="ml-2 text-sm text-gray-900 capitalize">
                          {risk.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRiskLevelBg(risk.risk_score)}`}>
                        {(risk.risk_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(risk.probability * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(risk.impact * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(risk.status)}`}>
                        {risk.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {risk.owner}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-1 flex-shrink-0" />
                        <span className="truncate">{new Date(risk.due_date).toLocaleDateString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monte Carlo Analysis Modal */}
        {showMonteCarloModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monte Carlo Risk Analysis</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Analysis Overview</h4>
                  <p className="text-sm text-blue-800">
                    Run statistical simulation on {filteredRisks.length} selected risks to analyze 
                    probability distributions and potential cost/schedule impacts.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Simulation Iterations
                    </label>
                    <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="10000">10,000 (Recommended)</option>
                      <option value="50000">50,000 (High Precision)</option>
                      <option value="100000">100,000 (Maximum Precision)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Analysis Type
                    </label>
                    <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="cost">Cost Impact Analysis</option>
                      <option value="schedule">Schedule Impact Analysis</option>
                      <option value="both">Combined Analysis</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Risk Selection</h4>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {filteredRisks.slice(0, 10).map((risk) => (
                      <div key={risk.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            defaultChecked
                            className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{risk.title}</span>
                            <div className="text-xs text-gray-500">
                              Risk Score: {(risk.risk_score * 100).toFixed(0)}%
                            </div>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRiskLevelBg(risk.risk_score)}`}>
                          {risk.category}
                        </span>
                      </div>
                    ))}
                    {filteredRisks.length > 10 && (
                      <div className="text-sm text-gray-500 text-center py-2">
                        ... and {filteredRisks.length - 10} more risks
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Estimated Analysis Time</h4>
                  <p className="text-sm text-yellow-800">
                    Approximately {Math.ceil(filteredRisks.length * 0.5)} seconds for {filteredRisks.length} risks
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowMonteCarloModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowMonteCarloModal(false)
                    // Redirect to Monte Carlo page with risk data
                    window.location.href = '/monte-carlo?risks=' + encodeURIComponent(JSON.stringify(filteredRisks.slice(0, 10)))
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  <Zap className="h-4 w-4 mr-2 inline" />
                  Run Analysis
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Mobile-First Add Risk Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-900">Add New Risk</h3>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                
                try {
                  const descriptionValue = formData.get('description') as string
                  const mitigationValue = formData.get('mitigation') as string
                  const ownerIdValue = formData.get('owner') as string
                  const dueDateValue = formData.get('due_date') as string
                  
                  await createRisk({
                    project_id: formData.get('project_id') as string,
                    title: formData.get('title') as string,
                    ...(descriptionValue && { description: descriptionValue }),
                    category: formData.get('category') as 'technical' | 'financial' | 'resource' | 'schedule' | 'external',
                    probability: parseFloat(formData.get('probability') as string) / 100,
                    impact: parseFloat(formData.get('impact') as string) / 100,
                    ...(mitigationValue && { mitigation: mitigationValue }),
                    ...(ownerIdValue && { owner_id: ownerIdValue }),
                    ...(dueDateValue && { due_date: dueDateValue })
                  })
                } catch (error) {
                  alert(error instanceof Error ? error.message : 'Failed to create risk')
                }
              }} className="p-4 sm:p-6 space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    name="title"
                    required
                    className="w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    placeholder="Enter risk title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full min-h-[88px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none"
                    placeholder="Describe the risk in detail"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project *</label>
                  <select
                    name="project_id"
                    required
                    className="w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  >
                    <option value="">Select a project</option>
                    <option value="1">Sample Project</option>
                    <option value="2">Another Project</option>
                    <option value="3">Third Project</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <select
                    name="category"
                    required
                    className="w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  >
                    <option value="">Select category</option>
                    <option value="technical">Technical</option>
                    <option value="financial">Financial</option>
                    <option value="resource">Resource</option>
                    <option value="schedule">Schedule</option>
                    <option value="external">External</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Probability (%)</label>
                    <input
                      type="number"
                      name="probability"
                      required
                      min="0"
                      max="100"
                      defaultValue="50"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Impact (%)</label>
                    <input
                      type="number"
                      name="impact"
                      required
                      min="0"
                      max="100"
                      defaultValue="50"
                      className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mitigation Strategy</label>
                  <textarea
                    name="mitigation"
                    rows={2}
                    placeholder="Describe how this risk will be mitigated..."
                    className="textarea-field w-full min-h-[66px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Owner</label>
                  <input
                    type="text"
                    name="owner"
                    placeholder="Risk owner name"
                    className="input-field w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                  <input
                    type="date"
                    name="due_date"
                    className="w-full min-h-[44px] p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 active:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 font-medium"
                  >
                    Add Risk
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}