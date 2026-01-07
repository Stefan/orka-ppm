'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { 
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, PieChart, BarChart3,
  Calendar, Filter, Download, RefreshCw, Eye, EyeOff, Target, Zap, Upload, 
  FileText, CheckCircle, XCircle, Clock, History
} from 'lucide-react'
import AppLayout from '../../components/AppLayout'
import { getApiUrl } from '../../lib/api'
import CommitmentsActualsView from './components/CommitmentsActualsView'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
  ComposedChart
} from 'recharts'

interface Project {
  id: string
  name: string
  budget?: number | null
  actual_cost?: number | null
  status: string
  health: 'green' | 'yellow' | 'red'
}

interface BudgetVariance {
  project_id: string
  total_planned: number
  total_actual: number
  variance_amount: number
  variance_percentage: number
  currency: string
  categories: Array<{
    category: string
    planned: number
    actual: number
    variance: number
    variance_percentage: number
  }>
  status: string
}

interface FinancialAlert {
  project_id: string
  project_name: string
  budget: number
  actual_cost: number
  utilization_percentage: number
  variance_amount: number
  alert_level: 'warning' | 'critical'
  message: string
}

interface FinancialMetrics {
  total_budget: number
  total_actual: number
  total_variance: number
  variance_percentage: number
  projects_over_budget: number
  projects_under_budget: number
  average_budget_utilization: number
  currency_distribution: Record<string, number>
}

interface TrendProjection {
  month: string
  projected_spending: number
  projected_variance: number
  confidence: number
}

interface CostAnalysis {
  category: string
  current_month: number
  previous_month: number
  trend: 'up' | 'down' | 'stable'
  percentage_change: number
}

interface BudgetPerformanceMetrics {
  on_track_projects: number
  at_risk_projects: number
  over_budget_projects: number
  total_savings: number
  total_overruns: number
  efficiency_score: number
}

interface ComprehensiveFinancialReport {
  report_metadata: {
    generated_at: string
    currency: string
    projects_included: number
    includes_trends: boolean
  }
  summary: {
    total_budget: number
    total_actual: number
    total_variance: number
    variance_percentage: number
    currency: string
  }
  project_analysis: Array<{
    project_id: string
    project_name: string
    budget: number
    actual_cost: number
    variance_amount: number
    variance_percentage: number
    utilization_percentage: number
    status: string
    health: string
  }>
  category_spending: Array<{
    category: string
    total_spending: number
    transaction_count: number
    average_per_transaction: number
  }>
  trend_projections: TrendProjection[]
  risk_indicators: {
    projects_over_budget: number
    projects_at_risk: number
    critical_projects: number
    average_utilization: number
  }
}

interface CSVImportHistory {
  id: string
  import_type: 'commitments' | 'actuals'
  file_name: string
  file_size: number
  records_processed: number
  records_imported: number
  records_failed: number
  import_status: 'processing' | 'completed' | 'failed'
  error_details: any
  started_at: string
  completed_at?: string
}

interface CSVUploadResult {
  success: boolean
  records_processed: number
  records_imported: number
  errors: Array<{
    row: number
    field: string
    message: string
  }>
  warnings: Array<{
    row: number
    field: string
    message: string
  }>
  import_id: string
}

export default function Financials() {
  const { session } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [budgetVariances, setBudgetVariances] = useState<BudgetVariance[]>([])
  const [financialAlerts, setFinancialAlerts] = useState<FinancialAlert[]>([])
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [comprehensiveReport, setComprehensiveReport] = useState<ComprehensiveFinancialReport | null>(null)
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysis[]>([])
  const [budgetPerformance, setBudgetPerformance] = useState<BudgetPerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const [dateRange, setDateRange] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'overview' | 'detailed' | 'trends' | 'analysis' | 'csv-import' | 'commitments-actuals'>('overview')
  
  // CSV Import states
  const [csvImportHistory, setCsvImportHistory] = useState<CSVImportHistory[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadResult, setUploadResult] = useState<CSVUploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  // Enhanced analytics data with cost analysis
  const analyticsData = useMemo(() => {
    if (!metrics || !budgetVariances.length) return null

    const budgetStatusData = [
      { name: 'Under Budget', value: metrics.projects_under_budget, color: '#10B981' },
      { name: 'Over Budget', value: metrics.projects_over_budget, color: '#EF4444' },
      { name: 'On Budget', value: projects.length - metrics.projects_over_budget - metrics.projects_under_budget, color: '#3B82F6' }
    ]

    const categorySpending = budgetVariances.reduce((acc, variance) => {
      variance.categories.forEach(cat => {
        if (!acc[cat.category]) {
          acc[cat.category] = { planned: 0, actual: 0, variance: 0 }
        }
        acc[cat.category].planned += cat.planned
        acc[cat.category].actual += cat.actual
        acc[cat.category].variance += cat.variance
      })
      return acc
    }, {} as Record<string, { planned: number, actual: number, variance: number }>)

    const categoryData = Object.entries(categorySpending).map(([category, data]) => ({
      name: category,
      planned: data.planned,
      actual: data.actual,
      variance: data.variance,
      variance_percentage: data.planned > 0 ? (data.variance / data.planned * 100) : 0,
      efficiency: data.planned > 0 ? ((data.planned - data.actual) / data.planned * 100) : 0
    }))

    const projectPerformanceData = budgetVariances.map(variance => {
      const project = projects.find(p => p.id === variance.project_id)
      return {
        name: project?.name.substring(0, 15) + '...' || 'Unknown',
        budget: variance.total_planned,
        actual: variance.total_actual,
        variance: variance.variance_amount,
        variance_percentage: variance.variance_percentage,
        health: project?.health || 'unknown',
        efficiency_score: variance.total_planned > 0 ? 
          Math.max(0, 100 - Math.abs(variance.variance_percentage)) : 0
      }
    }).sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))

    // Enhanced budget performance metrics
    const totalSavings = budgetVariances
      .filter(v => v.variance_amount < 0)
      .reduce((sum, v) => sum + Math.abs(v.variance_amount), 0)
    
    const totalOverruns = budgetVariances
      .filter(v => v.variance_amount > 0)
      .reduce((sum, v) => sum + v.variance_amount, 0)

    const avgEfficiency = projectPerformanceData.length > 0 
      ? projectPerformanceData.reduce((sum, p) => sum + p.efficiency_score, 0) / projectPerformanceData.length
      : 0

    return {
      budgetStatusData,
      categoryData,
      projectPerformanceData,
      totalProjects: projects.length,
      criticalAlerts: financialAlerts.filter(a => a.alert_level === 'critical').length,
      warningAlerts: financialAlerts.filter(a => a.alert_level === 'warning').length,
      totalSavings,
      totalOverruns,
      avgEfficiency,
      netVariance: totalOverruns - totalSavings
    }
  }, [metrics, budgetVariances, projects, financialAlerts])

  useEffect(() => {
    if (session) {
      fetchFinancialData()
      if (viewMode === 'csv-import') {
        fetchCSVImportHistory()
      }
    }
  }, [session, selectedCurrency, viewMode])

  async function fetchFinancialData() {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchProjects(),
        fetchBudgetVariances(),
        fetchFinancialAlerts(),
        fetchFinancialMetrics(),
        fetchComprehensiveReport(),
        fetchCostAnalysis(),
        fetchBudgetPerformance()
      ])
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchProjects() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/projects/'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(Array.isArray(data) ? data as Project[] : [])
    } catch (error: unknown) {
      console.error('Error fetching projects:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch projects')
    }
  }

  async function fetchBudgetVariances() {
    if (!session?.access_token) return
    
    const variances: BudgetVariance[] = []
    
    for (const project of projects) {
      try {
        const response = await fetch(getApiUrl(`/projects/${project.id}/budget-variance?currency=${selectedCurrency}`), {
          headers: {
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'Content-Type': 'application/json',
          }
        })
        
        if (response.ok) {
          const variance = await response.json()
          variances.push(variance)
        }
      } catch (error) {
        console.error(`Failed to fetch variance for project ${project.id}:`, error)
      }
    }
    
    setBudgetVariances(variances)
  }

  async function fetchFinancialAlerts() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/financial-tracking/budget-alerts?threshold_percentage=80'), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setFinancialAlerts(data.alerts || [])
      }
    } catch (error) {
      console.error('Failed to fetch financial alerts:', error)
    }
  }

  async function fetchFinancialMetrics() {
    if (!budgetVariances.length) return
    
    const totalBudget = budgetVariances.reduce((sum, v) => sum + v.total_planned, 0)
    const totalActual = budgetVariances.reduce((sum, v) => sum + v.total_actual, 0)
    const totalVariance = totalActual - totalBudget
    const variancePercentage = totalBudget > 0 ? (totalVariance / totalBudget * 100) : 0
    
    const projectsOverBudget = budgetVariances.filter(v => v.variance_amount > 0).length
    const projectsUnderBudget = budgetVariances.filter(v => v.variance_amount < 0).length
    
    const avgUtilization = budgetVariances.length > 0 
      ? budgetVariances.reduce((sum, v) => sum + (v.total_planned > 0 ? (v.total_actual / v.total_planned * 100) : 0), 0) / budgetVariances.length
      : 0

    setMetrics({
      total_budget: totalBudget,
      total_actual: totalActual,
      total_variance: totalVariance,
      variance_percentage: variancePercentage,
      projects_over_budget: projectsOverBudget,
      projects_under_budget: projectsUnderBudget,
      average_budget_utilization: avgUtilization,
      currency_distribution: { [selectedCurrency]: totalBudget }
    })
  }

  async function fetchComprehensiveReport() {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl(`/financial-tracking/comprehensive-report?currency=${selectedCurrency}&include_trends=true`), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setComprehensiveReport(data)
      }
    } catch (error) {
      console.error('Failed to fetch comprehensive financial report:', error)
    }
  }

  async function fetchCostAnalysis() {
    if (!session?.access_token) return
    
    try {
      // Simulate cost analysis data - in real implementation would come from backend
      const mockCostAnalysis: CostAnalysis[] = [
        {
          category: 'Development',
          current_month: 45000,
          previous_month: 42000,
          trend: 'up',
          percentage_change: 7.1
        },
        {
          category: 'Infrastructure',
          current_month: 12000,
          previous_month: 15000,
          trend: 'down',
          percentage_change: -20.0
        },
        {
          category: 'Marketing',
          current_month: 8000,
          previous_month: 8100,
          trend: 'stable',
          percentage_change: -1.2
        },
        {
          category: 'Operations',
          current_month: 18000,
          previous_month: 16500,
          trend: 'up',
          percentage_change: 9.1
        }
      ]
      setCostAnalysis(mockCostAnalysis)
    } catch (error) {
      console.error('Failed to fetch cost analysis:', error)
    }
  }

  async function fetchBudgetPerformance() {
    if (!budgetVariances.length) return
    
    try {
      const onTrack = budgetVariances.filter(v => Math.abs(v.variance_percentage) <= 5).length
      const atRisk = budgetVariances.filter(v => v.variance_percentage > 5 && v.variance_percentage <= 15).length
      const overBudget = budgetVariances.filter(v => v.variance_percentage > 15).length
      
      const totalSavings = budgetVariances
        .filter(v => v.variance_amount < 0)
        .reduce((sum, v) => sum + Math.abs(v.variance_amount), 0)
      
      const totalOverruns = budgetVariances
        .filter(v => v.variance_amount > 0)
        .reduce((sum, v) => sum + v.variance_amount, 0)

      const efficiencyScore = budgetVariances.length > 0 
        ? budgetVariances.reduce((sum, v) => {
            const efficiency = v.total_planned > 0 ? 
              Math.max(0, 100 - Math.abs(v.variance_percentage)) : 0
            return sum + efficiency
          }, 0) / budgetVariances.length
        : 0

      setBudgetPerformance({
        on_track_projects: onTrack,
        at_risk_projects: atRisk,
        over_budget_projects: overBudget,
        total_savings: totalSavings,
        total_overruns: totalOverruns,
        efficiency_score: efficiencyScore
      })
    } catch (error) {
      console.error('Failed to calculate budget performance:', error)
    }
  }

  const exportFinancialData = () => {
    const exportData = {
      metrics,
      budgetVariances,
      financialAlerts,
      comprehensiveReport,
      analytics: analyticsData,
      currency: selectedCurrency,
      view_mode: viewMode,
      exported_at: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-report-${viewMode}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // CSV Import Functions
  const fetchCSVImportHistory = async () => {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl('/csv-import/history'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCsvImportHistory(data.imports || [])
      }
    } catch (error) {
      console.error('Failed to fetch CSV import history:', error)
    }
  }

  const handleFileUpload = async (file: File, importType: 'commitments' | 'actuals') => {
    if (!session?.access_token) return
    
    setUploadingFile(true)
    setUploadResult(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(getApiUrl(`/csv-import/upload?import_type=${importType}`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData
      })
      
      if (response.ok) {
        const result = await response.json()
        setUploadResult(result)
        fetchCSVImportHistory() // Refresh history
        fetchFinancialData() // Refresh financial data
      } else {
        const error = await response.json()
        setUploadResult({
          success: false,
          records_processed: 0,
          records_imported: 0,
          errors: [{ row: 0, field: 'file', message: error.detail || 'Upload failed' }],
          warnings: [],
          import_id: ''
        })
      }
    } catch (error) {
      setUploadResult({
        success: false,
        records_processed: 0,
        records_imported: 0,
        errors: [{ row: 0, field: 'file', message: error instanceof Error ? error.message : 'Upload failed' }],
        warnings: [],
        import_id: ''
      })
    } finally {
      setUploadingFile(false)
    }
  }

  const downloadTemplate = async (importType: 'commitments' | 'actuals') => {
    if (!session?.access_token) return
    
    try {
      const response = await fetch(getApiUrl(`/csv-import/template/${importType}`), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${importType}_template.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download template:', error)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent, importType: 'commitments' | 'actuals') => {
    e.preventDefault()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.toLowerCase().endsWith('.csv')) {
        handleFileUpload(file, importType)
      } else {
        alert('Bitte wählen Sie eine CSV-Datei aus.')
      }
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
              <h3 className="text-sm font-medium text-red-800">Error loading financial data</h3>
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
        {/* Enhanced Header */}
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
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
            
            <button
              onClick={() => setViewMode(
                viewMode === 'overview' ? 'detailed' : 
                viewMode === 'detailed' ? 'trends' : 
                viewMode === 'trends' ? 'analysis' : 
                viewMode === 'analysis' ? 'csv-import' : 
                viewMode === 'csv-import' ? 'commitments-actuals' : 'overview'
              )}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {viewMode === 'overview' ? <BarChart3 className="h-4 w-4 mr-2" /> : 
               viewMode === 'detailed' ? <TrendingUp className="h-4 w-4 mr-2" /> : 
               viewMode === 'trends' ? <PieChart className="h-4 w-4 mr-2" /> :
               viewMode === 'analysis' ? <Upload className="h-4 w-4 mr-2" /> :
               viewMode === 'csv-import' ? <Target className="h-4 w-4 mr-2" /> :
               <Target className="h-4 w-4 mr-2" />}
              {viewMode === 'overview' ? 'Detailliert' : 
               viewMode === 'detailed' ? 'Trends' : 
               viewMode === 'trends' ? 'Analyse' : 
               viewMode === 'analysis' ? 'CSV Import' : 
               viewMode === 'csv-import' ? 'Commitments vs Actuals' : 'Übersicht'}
            </button>
            
            <button
              onClick={exportFinancialData}
              className="flex items-center px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            
            <button
              onClick={fetchFinancialData}
              className="flex items-center px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>
        </div>

        {/* Enhanced Financial Metrics Dashboard */}
        {metrics && (
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
                <BarChart3 className="h-8 w-8 text-orange-600" />
              </div>
            </div>

            {/* New Enhanced KPIs */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Efficiency Score</p>
                  <p className="text-2xl font-bold text-green-600">
                    {analyticsData?.avgEfficiency.toFixed(0) || 0}%
                  </p>
                </div>
                <Zap className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Net Variance</p>
                  <p className={`text-2xl font-bold ${(analyticsData?.netVariance || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {(analyticsData?.netVariance || 0) >= 0 ? '+' : ''}{(analyticsData?.netVariance || 0).toLocaleString()} {selectedCurrency}
                  </p>
                </div>
                <PieChart className="h-8 w-8 text-gray-600" />
              </div>
            </div>
          </div>
        )}

        {/* Critical Alerts */}
        {financialAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-red-900">Budget Alerts</h3>
              <span className="text-sm text-red-700">{financialAlerts.length} alert{financialAlerts.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {financialAlerts.slice(0, 5).map((alert, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{alert.project_name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Budget: {alert.budget.toLocaleString()} {selectedCurrency}</span>
                        <span>Spent: {alert.actual_cost.toLocaleString()} {selectedCurrency}</span>
                        <span>Utilization: {alert.utilization_percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.alert_level === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}
                    >
                      {alert.alert_level}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                >
                  <option value="all">All Time</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="1y">Last Year</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Budget Status</label>
                <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white">
                  <option value="all">All Projects</option>
                  <option value="over">Over Budget</option>
                  <option value="under">Under Budget</option>
                  <option value="on">On Budget</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alert Level</label>
                <select className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white">
                  <option value="all">All Levels</option>
                  <option value="critical">Critical Only</option>
                  <option value="warning">Warning Only</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <button className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Charts and Analytics */}
        {analyticsData && viewMode === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Enhanced Budget Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Budget Status Distribution</h3>
                <div className="text-sm text-gray-600">
                  {analyticsData.totalProjects} total projects
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={analyticsData.budgetStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.budgetStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            {/* Enhanced Category Spending Analysis */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Spending by Category</h3>
                <div className="text-sm text-gray-600">
                  All amounts in {selectedCurrency}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.categoryData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                    name === 'planned' ? 'Planned' : 
                    name === 'actual' ? 'Actual' : 
                    name === 'efficiency' ? 'Efficiency %' : 'Variance'
                  ]}
                  />
                  <Legend />
                  <Bar dataKey="planned" fill="#3B82F6" name="Planned" />
                  <Bar dataKey="actual" fill="#10B981" name="Actual" />
                  <Bar dataKey="efficiency" fill="#F59E0B" name="Efficiency %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Enhanced Project Performance with Efficiency Scores */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Project Budget Performance</h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Top 10 by variance</span>
                  <span>•</span>
                  <span>Efficiency scores included</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={analyticsData.projectPerformanceData.slice(0, 10)}>
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value, name) => [
                    typeof value === 'number' ? 
                      (name === 'efficiency_score' ? `${value.toFixed(1)}%` : `${value.toLocaleString()} ${selectedCurrency}`) : 
                      value,
                    name === 'budget' ? 'Budget' : 
                    name === 'actual' ? 'Actual' : 
                    name === 'efficiency_score' ? 'Efficiency Score' : 'Variance %'
                  ]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="budget" fill="#3B82F6" name="Budget" />
                  <Bar yAxisId="left" dataKey="actual" fill="#10B981" name="Actual" />
                  <Line yAxisId="right" type="monotone" dataKey="efficiency_score" stroke="#F59E0B" strokeWidth={3} name="Efficiency Score" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Cost Analysis View - New Enhanced Section */}
        {viewMode === 'analysis' && (
          <div className="space-y-6">
            {/* Budget Performance Overview */}
            {budgetPerformance && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Performance Analysis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {budgetPerformance.on_track_projects}
                    </div>
                    <div className="text-sm text-green-800">Projects On Track</div>
                    <div className="text-xs text-green-600 mt-1">±5% variance</div>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {budgetPerformance.at_risk_projects}
                    </div>
                    <div className="text-sm text-yellow-800">Projects At Risk</div>
                    <div className="text-xs text-yellow-600 mt-1">5-15% variance</div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {budgetPerformance.over_budget_projects}
                    </div>
                    <div className="text-sm text-red-800">Over Budget</div>
                    <div className="text-xs text-red-600 mt-1">&gt;15% variance</div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {budgetPerformance.efficiency_score.toFixed(1)}%
                    </div>
                    <div className="text-sm text-blue-800">Efficiency Score</div>
                    <div className="text-xs text-blue-600 mt-1">Portfolio average</div>
                  </div>
                </div>

                {/* Savings vs Overruns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="text-md font-medium text-green-800 mb-2">Total Savings</h4>
                    <div className="text-3xl font-bold text-green-600">
                      {budgetPerformance.total_savings.toLocaleString()} {selectedCurrency}
                    </div>
                    <div className="text-sm text-green-700 mt-1">
                      From {budgetVariances.filter(v => v.variance_amount < 0).length} under-budget projects
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="text-md font-medium text-red-800 mb-2">Total Overruns</h4>
                    <div className="text-3xl font-bold text-red-600">
                      {budgetPerformance.total_overruns.toLocaleString()} {selectedCurrency}
                    </div>
                    <div className="text-sm text-red-700 mt-1">
                      From {budgetVariances.filter(v => v.variance_amount > 0).length} over-budget projects
                    </div>
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
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={costAnalysis}>
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip formatter={(value, name) => [
                          typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                          name === 'current_month' ? 'Current Month' : 'Previous Month'
                        ]}
                        />
                        <Legend />
                        <Bar dataKey="current_month" fill="#3B82F6" name="Current Month" />
                        <Bar dataKey="previous_month" fill="#9CA3AF" name="Previous Month" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Cost Analysis Table */}
                  <div>
                    <h4 className="text-md font-medium text-gray-800 mb-3">Category Performance</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {costAnalysis.map((category, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{category.category}</td>
                              <td className="px-4 py-2 text-sm">
                                <div className="flex items-center">
                                  {category.trend === 'up' ? (
                                    <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
                                  ) : category.trend === 'down' ? (
                                    <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
                                  ) : (
                                    <div className="h-4 w-4 bg-gray-400 rounded-full mr-1"></div>
                                  )}
                                  <span className={
                                    category.trend === 'up' ? 'text-red-600' :
                                    category.trend === 'down' ? 'text-green-600' : 'text-gray-600'
                                  }
                                  >
                                    {category.trend}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-sm">
                                <span className={
                                  category.percentage_change > 0 ? 'text-red-600' :
                                  category.percentage_change < 0 ? 'text-green-600' : 'text-gray-600'
                                }
                                >
                                  {category.percentage_change > 0 ? '+' : ''}{category.percentage_change.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Project Efficiency Analysis */}
            {analyticsData && (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Efficiency Analysis</h3>
                
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={analyticsData.projectPerformanceData.slice(0, 10)}>
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value, name) => [
                      typeof value === 'number' ? 
                        (name === 'efficiency_score' ? `${value.toFixed(1)}%` : `${value.toLocaleString()} ${selectedCurrency}`) : 
                        value,
                      name === 'budget' ? 'Budget' : 
                      name === 'actual' ? 'Actual' : 
                      name === 'efficiency_score' ? 'Efficiency Score' : name
                    ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="budget" fill="#3B82F6" name="Budget" />
                    <Bar yAxisId="left" dataKey="actual" fill="#10B981" name="Actual" />
                    <Line yAxisId="right" type="monotone" dataKey="efficiency_score" stroke="#F59E0B" strokeWidth={3} name="Efficiency Score" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Trend Projections */}
        {viewMode === 'trends' && comprehensiveReport?.trend_projections && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Financial Trend Projections</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>Next 6 months forecast</span>
                <span>•</span>
                <span>Currency: {selectedCurrency}</span>
                <span>•</span>
                <span>Based on current spending patterns</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enhanced Spending Trend Chart with Confidence Bands */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">Projected Spending Trend</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={comprehensiveReport.trend_projections}>
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [
                      typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                      name === 'projected_spending' ? 'Projected Spending' : 'Projected Variance'
                    ]}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="projected_spending" 
                      stroke="#3B82F6" 
                      fill="#3B82F6" 
                      fillOpacity={0.3}
                      name="Projected Spending"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="projected_variance" 
                      stroke="#EF4444" 
                      strokeWidth={2}
                      name="Projected Variance"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Enhanced Confidence Levels with Risk Assessment */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">Forecast Confidence & Risk</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={comprehensiveReport.trend_projections}>
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" domain={[0, 1]} tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip formatter={(value, name) => [
                      name === 'confidence' ? `${((value as number) * 100).toFixed(1)}%` : 
                      typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                      name === 'confidence' ? 'Confidence Level' : 'Risk Amount'
                    ]}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="confidence" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      name="Confidence Level"
                    />
                    <Bar 
                      yAxisId="right"
                      dataKey="projected_variance" 
                      fill="#F59E0B" 
                      fillOpacity={0.6}
                      name="Risk Amount"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Enhanced Risk Indicators from Comprehensive Report */}
            {comprehensiveReport.risk_indicators && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-800 mb-4">Financial Risk Assessment</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="text-2xl font-bold text-red-600">
                      {comprehensiveReport.risk_indicators.projects_over_budget}
                    </div>
                    <div className="text-sm text-red-800">Projects Over Budget</div>
                    <div className="text-xs text-red-600 mt-1">High risk</div>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-600">
                      {comprehensiveReport.risk_indicators.projects_at_risk}
                    </div>
                    <div className="text-sm text-yellow-800">Projects at Risk</div>
                    <div className="text-xs text-yellow-600 mt-1">Medium risk</div>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <div className="text-2xl font-bold text-orange-600">
                      {comprehensiveReport.risk_indicators.critical_projects}
                    </div>
                    <div className="text-sm text-orange-800">Critical Projects</div>
                    <div className="text-xs text-orange-600 mt-1">Immediate attention</div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-600">
                      {comprehensiveReport.risk_indicators.average_utilization.toFixed(1)}%
                    </div>
                    <div className="text-sm text-blue-800">Avg. Utilization</div>
                    <div className="text-xs text-blue-600 mt-1">Portfolio efficiency</div>
                  </div>
                </div>
              </div>
            )}

            {/* Projection Summary */}
            <div className="mt-6 bg-gray-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-gray-800 mb-2">6-Month Projection Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Expected Total Spending:</span>
                  <div className="font-semibold text-gray-900">
                    {comprehensiveReport.trend_projections[5]?.projected_spending.toLocaleString()} {selectedCurrency}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Projected Variance:</span>
                  <div className={`font-semibold ${
                    (comprehensiveReport.trend_projections[5]?.projected_variance || 0) >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                  >
                    {(comprehensiveReport.trend_projections[5]?.projected_variance || 0) >= 0 ? '+' : ''}
                    {comprehensiveReport.trend_projections[5]?.projected_variance.toLocaleString()} {selectedCurrency}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Confidence Level:</span>
                  <div className="font-semibold text-gray-900">
                    {((comprehensiveReport.trend_projections[5]?.confidence || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Category Analysis */}
        {viewMode === 'detailed' && comprehensiveReport?.category_spending && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Category Analysis</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>All amounts in {selectedCurrency}</span>
                <span>•</span>
                <span>{comprehensiveReport.category_spending.length} categories</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enhanced Category Spending Chart */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">Category Spending Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comprehensiveReport.category_spending}>
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [
                      typeof value === 'number' ? `${value.toLocaleString()} ${selectedCurrency}` : value,
                      name === 'total_spending' ? 'Total Spending' : 'Avg per Transaction'
                    ]}
                    />
                    <Legend />
                    <Bar dataKey="total_spending" fill="#3B82F6" name="Total Spending" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Enhanced Category Details Table */}
              <div className="overflow-x-auto">
                <h4 className="text-md font-medium text-gray-800 mb-3">Category Performance Metrics</h4>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total ({selectedCurrency})</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg/Transaction</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {comprehensiveReport.category_spending
                      .sort((a, b) => b.total_spending - a.total_spending)
                      .map((category, index) => {
                        const totalSpending = comprehensiveReport.category_spending.reduce((sum, cat) => sum + cat.total_spending, 0)
                        const percentage = totalSpending > 0 ? (category.total_spending / totalSpending * 100) : 0
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{category.category}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {category.total_spending.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{category.transaction_count}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {category.average_per_transaction.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <div className="flex items-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                  >
                                  </div>
                                </div>
                                <span className="text-gray-600">{percentage.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Category Insights */}
            <div className="mt-6 bg-blue-50 p-4 rounded-lg">
              <h4 className="text-md font-medium text-blue-800 mb-2">Category Insights</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-600">Highest Spending Category:</span>
                  <div className="font-semibold text-blue-900">
                    {comprehensiveReport.category_spending
                      .sort((a, b) => b.total_spending - a.total_spending)[0]?.category || 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-blue-600">Most Active Category:</span>
                  <div className="font-semibold text-blue-900">
                    {comprehensiveReport.category_spending
                      .sort((a, b) => b.transaction_count - a.transaction_count)[0]?.category || 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-blue-600">Highest Avg Transaction:</span>
                  <div className="font-semibold text-blue-900">
                    {comprehensiveReport.category_spending
                      .sort((a, b) => b.average_per_transaction - a.average_per_transaction)[0]?.category || 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Interface */}
        {viewMode === 'csv-import' && (
          <div className="space-y-6">
            {/* CSV Import Header */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">CSV Datenimport</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>Unterstützte Formate: CSV</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Commitments Upload */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-800">Commitments (Bestellungen)</h4>
                    <button
                      onClick={() => downloadTemplate('commitments')}
                      className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Vorlage
                    </button>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'commitments')}
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      CSV-Datei hier ablegen oder klicken zum Auswählen
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'commitments')
                      }}
                      className="hidden"
                      id="commitments-upload"
                    />
                    <label
                      htmlFor="commitments-upload"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Datei auswählen
                    </label>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>• Maximale Dateigröße: 50MB</p>
                    <p>• Unterstützte Spalten: PO-Nummer, Betrag, Währung, Projekt, WBS</p>
                  </div>
                </div>

                {/* Actuals Upload */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-800">Actuals (Ist-Kosten)</h4>
                    <button
                      onClick={() => downloadTemplate('actuals')}
                      className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Vorlage
                    </button>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'actuals')}
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      CSV-Datei hier ablegen oder klicken zum Auswählen
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'actuals')
                      }}
                      className="hidden"
                      id="actuals-upload"
                    />
                    <label
                      htmlFor="actuals-upload"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Datei auswählen
                    </label>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>• Maximale Dateigröße: 50MB</p>
                    <p>• Unterstützte Spalten: FI-Dokument, Betrag, Währung, Projekt, WBS</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Progress */}
            {uploadingFile && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-blue-800">Datei wird verarbeitet...</span>
                </div>
              </div>
            )}

            {/* Upload Result */}
            {uploadResult && (
              <div className={`border rounded-lg p-4 ${
                uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
              >
                <div className="flex items-start">
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className={`font-medium ${
                      uploadResult.success ? 'text-green-800' : 'text-red-800'
                    }`}
                    >
                      {uploadResult.success ? 'Import erfolgreich' : 'Import fehlgeschlagen'}
                    </h4>
                    
                    <div className="mt-2 text-sm">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-gray-600">Verarbeitet:</span>
                          <span className="font-medium ml-1">{uploadResult.records_processed}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Importiert:</span>
                          <span className="font-medium ml-1 text-green-600">{uploadResult.records_imported}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Fehler:</span>
                          <span className="font-medium ml-1 text-red-600">{uploadResult.errors.length}</span>
                        </div>
                      </div>
                    </div>

                    {uploadResult.errors.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-red-800 mb-2">Fehler:</h5>
                        <div className="max-h-32 overflow-y-auto">
                          {uploadResult.errors.slice(0, 5).map((error, index) => (
                            <div key={index} className="text-xs text-red-700 mb-1">
                              Zeile {error.row}: {error.message}
                            </div>
                          ))}
                          {uploadResult.errors.length > 5 && (
                            <div className="text-xs text-red-600">
                              ... und {uploadResult.errors.length - 5} weitere Fehler
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {uploadResult.warnings.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-yellow-800 mb-2">Warnungen:</h5>
                        <div className="max-h-32 overflow-y-auto">
                          {uploadResult.warnings.slice(0, 3).map((warning, index) => (
                            <div key={index} className="text-xs text-yellow-700 mb-1">
                              Zeile {warning.row}: {warning.message}
                            </div>
                          ))}
                          {uploadResult.warnings.length > 3 && (
                            <div className="text-xs text-yellow-600">
                              ... und {uploadResult.warnings.length - 3} weitere Warnungen
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Import History */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Import-Verlauf</h3>
                  <button
                    onClick={fetchCSVImportHistory}
                    className="flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Aktualisieren
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datei</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datensätze</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Größe</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvImportHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          Noch keine Imports durchgeführt
                        </td>
                      </tr>
                    ) : (
                      csvImportHistory.map((importRecord) => (
                        <tr key={importRecord.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              importRecord.import_type === 'commitments' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}
                            >
                              {importRecord.import_type === 'commitments' ? 'Commitments' : 'Actuals'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {importRecord.file_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {importRecord.import_status === 'completed' ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              ) : importRecord.import_status === 'failed' ? (
                                <XCircle className="h-4 w-4 text-red-500 mr-1" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                              )}
                              <span className={`text-sm ${
                                importRecord.import_status === 'completed' ? 'text-green-800' :
                                importRecord.import_status === 'failed' ? 'text-red-800' : 'text-yellow-800'
                              }`}
                              >
                                {importRecord.import_status === 'completed' ? 'Abgeschlossen' :
                                 importRecord.import_status === 'failed' ? 'Fehlgeschlagen' : 'In Bearbeitung'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center space-x-2">
                              <span className="text-green-600">{importRecord.records_imported}</span>
                              <span className="text-gray-400">/</span>
                              <span>{importRecord.records_processed}</span>
                              {importRecord.records_failed > 0 && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-red-600">{importRecord.records_failed} Fehler</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(importRecord.started_at).toLocaleString('de-DE')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(importRecord.file_size / 1024).toFixed(1)} KB
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Commitments vs Actuals Dashboard */}
        {viewMode === 'commitments-actuals' && (
          <CommitmentsActualsView 
            session={session}
            selectedCurrency={selectedCurrency}
            onRefresh={fetchFinancialData}
          />
        )}

        {/* CSV Import Header */}
        {viewMode === 'csv-import' && (
          <div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">CSV Datenimport</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>Unterstützte Formate: CSV</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Commitments Upload */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-800">Commitments (Bestellungen)</h4>
                    <button
                      onClick={() => downloadTemplate('commitments')}
                      className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Vorlage
                    </button>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'commitments')}
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      CSV-Datei hier ablegen oder klicken zum Auswählen
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'commitments')
                      }}
                      className="hidden"
                      id="commitments-upload"
                    />
                    <label
                      htmlFor="commitments-upload"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Datei auswählen
                    </label>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>• Maximale Dateigröße: 50MB</p>
                    <p>• Unterstützte Spalten: PO-Nummer, Betrag, Währung, Projekt, WBS</p>
                  </div>
                </div>

                {/* Actuals Upload */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-medium text-gray-800">Actuals (Ist-Kosten)</h4>
                    <button
                      onClick={() => downloadTemplate('actuals')}
                      className="flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Vorlage
                    </button>
                  </div>
                  
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, 'actuals')}
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      CSV-Datei hier ablegen oder klicken zum Auswählen
                    </p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileUpload(file, 'actuals')
                      }}
                      className="hidden"
                      id="actuals-upload"
                    />
                    <label
                      htmlFor="actuals-upload"
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Datei auswählen
                    </label>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>• Maximale Dateigröße: 50MB</p>
                    <p>• Unterstützte Spalten: FI-Dokument, Betrag, Währung, Projekt, WBS</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Progress */}
            {uploadingFile && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                  <span className="text-blue-800">Datei wird verarbeitet...</span>
                </div>
              </div>
            )}

            {/* Upload Result */}
            {uploadResult && (
              <div className={`border rounded-lg p-4 ${
                uploadResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
              >
                <div className="flex items-start">
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className={`font-medium ${
                      uploadResult.success ? 'text-green-800' : 'text-red-800'
                    }`}
                    >
                      {uploadResult.success ? 'Import erfolgreich' : 'Import fehlgeschlagen'}
                    </h4>
                    
                    <div className="mt-2 text-sm">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-gray-600">Verarbeitet:</span>
                          <span className="font-medium ml-1">{uploadResult.records_processed}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Importiert:</span>
                          <span className="font-medium ml-1 text-green-600">{uploadResult.records_imported}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Fehler:</span>
                          <span className="font-medium ml-1 text-red-600">{uploadResult.errors.length}</span>
                        </div>
                      </div>
                    </div>

                    {uploadResult.errors.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-red-800 mb-2">Fehler:</h5>
                        <div className="max-h-32 overflow-y-auto">
                          {uploadResult.errors.slice(0, 5).map((error, index) => (
                            <div key={index} className="text-xs text-red-700 mb-1">
                              Zeile {error.row}: {error.message}
                            </div>
                          ))}
                          {uploadResult.errors.length > 5 && (
                            <div className="text-xs text-red-600">
                              ... und {uploadResult.errors.length - 5} weitere Fehler
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {uploadResult.warnings.length > 0 && (
                      <div className="mt-3">
                        <h5 className="text-sm font-medium text-yellow-800 mb-2">Warnungen:</h5>
                        <div className="max-h-32 overflow-y-auto">
                          {uploadResult.warnings.slice(0, 3).map((warning, index) => (
                            <div key={index} className="text-xs text-yellow-700 mb-1">
                              Zeile {warning.row}: {warning.message}
                            </div>
                          ))}
                          {uploadResult.warnings.length > 3 && (
                            <div className="text-xs text-yellow-600">
                              ... und {uploadResult.warnings.length - 3} weitere Warnungen
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Import History */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Import-Verlauf</h3>
                  <button
                    onClick={fetchCSVImportHistory}
                    className="flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Aktualisieren
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Typ</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datei</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datensätze</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Datum</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Größe</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvImportHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          <History className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          Noch keine Imports durchgeführt
                        </td>
                      </tr>
                    ) : (
                      csvImportHistory.map((importRecord) => (
                        <tr key={importRecord.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              importRecord.import_type === 'commitments' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}
                            >
                              {importRecord.import_type === 'commitments' ? 'Commitments' : 'Actuals'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {importRecord.file_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {importRecord.import_status === 'completed' ? (
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                              ) : importRecord.import_status === 'failed' ? (
                                <XCircle className="h-4 w-4 text-red-500 mr-1" />
                              ) : (
                                <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                              )}
                              <span className={`text-sm ${
                                importRecord.import_status === 'completed' ? 'text-green-800' :
                                importRecord.import_status === 'failed' ? 'text-red-800' : 'text-yellow-800'
                              }`}
                              >
                                {importRecord.import_status === 'completed' ? 'Abgeschlossen' :
                                 importRecord.import_status === 'failed' ? 'Fehlgeschlagen' : 'In Bearbeitung'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center space-x-2">
                              <span className="text-green-600">{importRecord.records_imported}</span>
                              <span className="text-gray-400">/</span>
                              <span>{importRecord.records_processed}</span>
                              {importRecord.records_failed > 0 && (
                                <>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-red-600">{importRecord.records_failed} Fehler</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(importRecord.started_at).toLocaleString('de-DE')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(importRecord.file_size / 1024).toFixed(1)} KB
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Budget Variance Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Budget Variance Analysis ({budgetVariances.length} projects)
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>All amounts in {selectedCurrency}</span>
                {analyticsData && (
                  <>
                    <span>•</span>
                    <span>Avg Efficiency: {analyticsData.avgEfficiency.toFixed(1)}%</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Efficiency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {budgetVariances
                  .sort((a, b) => Math.abs(b.variance_percentage) - Math.abs(a.variance_percentage))
                  .map((variance) => {
                    const project = projects.find(p => p.id === variance.project_id)
                    const efficiency = variance.total_planned > 0 ? 
                      Math.max(0, 100 - Math.abs(variance.variance_percentage)) : 0
                    
                    return (
                      <tr key={variance.project_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {project?.name || 'Unknown Project'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {variance.total_planned.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {variance.total_actual.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={variance.variance_amount >= 0 ? 'text-red-600' : 'text-green-600'}>
                            {variance.variance_amount >= 0 ? '+' : ''}{variance.variance_amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={variance.variance_percentage >= 0 ? 'text-red-600' : 'text-green-600'}>
                            {variance.variance_percentage >= 0 ? '+' : ''}{variance.variance_percentage.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  efficiency >= 80 ? 'bg-green-500' : 
                                  efficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(efficiency, 100)}%` }}
                              >
                              </div>
                            </div>
                            <span className={
                              efficiency >= 80 ? 'text-green-600' : 
                              efficiency >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }
                            >
                              {efficiency.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            variance.status === 'over_budget' ? 'bg-red-100 text-red-800' :
                            variance.status === 'under_budget' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}
                          >
                            {variance.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            project?.health === 'green' ? 'bg-green-100 text-green-800' :
                            project?.health === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                            project?.health === 'red' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                          >
                            {project?.health || 'unknown'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          
          {/* Table Summary */}
          {analyticsData && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Savings:</span>
                  <div className="font-semibold text-green-600">
                    {analyticsData.totalSavings.toLocaleString()} {selectedCurrency}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Total Overruns:</span>
                  <div className="font-semibold text-red-600">
                    {analyticsData.totalOverruns.toLocaleString()} {selectedCurrency}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Net Variance:</span>
                  <div className={`font-semibold ${analyticsData.netVariance >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {analyticsData.netVariance >= 0 ? '+' : ''}{analyticsData.netVariance.toLocaleString()} {selectedCurrency}
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Portfolio Efficiency:</span>
                  <div className="font-semibold text-blue-600">
                    {analyticsData.avgEfficiency.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}