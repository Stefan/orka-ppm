'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, ScatterChart, Scatter } from 'recharts'
import { Clock, Users, AlertTriangle, Target, Filter, Download, RefreshCw, Eye, ArrowUp, ArrowDown, Minus } from 'lucide-react'

// Types for performance monitoring data
interface ApprovalTimeMetrics {
  approver_id: string
  approver_name: string
  total_approvals: number
  avg_approval_time_hours: number
  overdue_approvals: number
  approval_rate: number
  bottleneck_score: number
}

interface ChangeSuccessMetrics {
  change_type: string
  total_changes: number
  successful_implementations: number
  success_rate: number
  avg_cost_variance: number
  avg_schedule_variance: number
  impact_accuracy_score: number
}

interface TeamPerformanceMetrics {
  team_member_id: string
  team_member_name: string
  role: string
  changes_handled: number
  avg_processing_time_hours: number
  quality_score: number
  workload_percentage: number
  efficiency_rating: number
}

interface BottleneckAnalysis {
  bottleneck_type: 'approval' | 'implementation' | 'analysis' | 'communication'
  description: string
  affected_changes: number
  avg_delay_days: number
  impact_severity: 'low' | 'medium' | 'high' | 'critical'
  suggested_actions: string[]
}

interface PerformanceMonitoringData {
  approval_time_metrics: ApprovalTimeMetrics[]
  change_success_metrics: ChangeSuccessMetrics[]
  team_performance_metrics: TeamPerformanceMetrics[]
  bottleneck_analysis: BottleneckAnalysis[]
  
  // Aggregate metrics
  overall_approval_time_trend: Array<{
    date: string
    avg_approval_time: number
    target_approval_time: number
    volume: number
  }>
  
  success_rate_trend: Array<{
    date: string
    success_rate: number
    target_success_rate: number
    total_implementations: number
  }>
  
  workload_distribution: Array<{
    team_member: string
    current_workload: number
    capacity: number
    utilization_percentage: number
  }>
}

interface PerformanceMonitoringInterfaceProps {
  projectId?: string
  dateRange: {
    from: Date
    to: Date
  }
  teamFilter?: string[]
  onBottleneckAction?: (bottleneck: BottleneckAnalysis, action: string) => void
}

export default function PerformanceMonitoringInterface({
  projectId,
  dateRange,
  teamFilter = [],
  onBottleneckAction
}: PerformanceMonitoringInterfaceProps) {
  const [performanceData, setPerformanceData] = useState<PerformanceMonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'approval' | 'success' | 'team' | 'bottlenecks'>('approval')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedBottleneck, setSelectedBottleneck] = useState<BottleneckAnalysis | null>(null)

  // Mock data for demonstration - replace with actual API call
  useEffect(() => {
    const fetchPerformanceData = async () => {
      setLoading(true)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockData: PerformanceMonitoringData = {
        approval_time_metrics: [
          {
            approver_id: 'user-1',
            approver_name: 'John Smith',
            total_approvals: 45,
            avg_approval_time_hours: 18.5,
            overdue_approvals: 3,
            approval_rate: 92.3,
            bottleneck_score: 2.1
          },
          {
            approver_id: 'user-2',
            approver_name: 'Sarah Johnson',
            total_approvals: 38,
            avg_approval_time_hours: 12.2,
            overdue_approvals: 1,
            approval_rate: 96.8,
            bottleneck_score: 1.2
          },
          {
            approver_id: 'user-3',
            approver_name: 'Mike Davis',
            total_approvals: 52,
            avg_approval_time_hours: 28.7,
            overdue_approvals: 8,
            approval_rate: 85.4,
            bottleneck_score: 4.2
          },
          {
            approver_id: 'user-4',
            approver_name: 'Lisa Chen',
            total_approvals: 29,
            avg_approval_time_hours: 15.8,
            overdue_approvals: 2,
            approval_rate: 93.1,
            bottleneck_score: 1.8
          },
          {
            approver_id: 'user-5',
            approver_name: 'Robert Wilson',
            total_approvals: 41,
            avg_approval_time_hours: 22.3,
            overdue_approvals: 5,
            approval_rate: 87.8,
            bottleneck_score: 3.1
          }
        ],
        
        change_success_metrics: [
          {
            change_type: 'scope',
            total_changes: 45,
            successful_implementations: 39,
            success_rate: 86.7,
            avg_cost_variance: 12.5,
            avg_schedule_variance: 8.3,
            impact_accuracy_score: 82.1
          },
          {
            change_type: 'schedule',
            total_changes: 38,
            successful_implementations: 35,
            success_rate: 92.1,
            avg_cost_variance: 6.8,
            avg_schedule_variance: 15.2,
            impact_accuracy_score: 78.9
          },
          {
            change_type: 'budget',
            total_changes: 32,
            successful_implementations: 28,
            success_rate: 87.5,
            avg_cost_variance: 18.7,
            avg_schedule_variance: 5.1,
            impact_accuracy_score: 85.3
          },
          {
            change_type: 'design',
            total_changes: 25,
            successful_implementations: 21,
            success_rate: 84.0,
            avg_cost_variance: 22.1,
            avg_schedule_variance: 19.8,
            impact_accuracy_score: 76.4
          },
          {
            change_type: 'regulatory',
            total_changes: 16,
            successful_implementations: 15,
            success_rate: 93.8,
            avg_cost_variance: 8.9,
            avg_schedule_variance: 11.2,
            impact_accuracy_score: 88.7
          }
        ],
        
        team_performance_metrics: [
          {
            team_member_id: 'tm-1',
            team_member_name: 'Alice Brown',
            role: 'Change Analyst',
            changes_handled: 28,
            avg_processing_time_hours: 6.5,
            quality_score: 94.2,
            workload_percentage: 85,
            efficiency_rating: 4.6
          },
          {
            team_member_id: 'tm-2',
            team_member_name: 'David Lee',
            role: 'Implementation Manager',
            changes_handled: 35,
            avg_processing_time_hours: 24.8,
            quality_score: 91.7,
            workload_percentage: 92,
            efficiency_rating: 4.3
          },
          {
            team_member_id: 'tm-3',
            team_member_name: 'Emma Taylor',
            role: 'Impact Analyst',
            changes_handled: 42,
            avg_processing_time_hours: 8.2,
            quality_score: 96.1,
            workload_percentage: 78,
            efficiency_rating: 4.8
          },
          {
            team_member_id: 'tm-4',
            team_member_name: 'James Wilson',
            role: 'Project Coordinator',
            changes_handled: 31,
            avg_processing_time_hours: 4.1,
            quality_score: 89.3,
            workload_percentage: 68,
            efficiency_rating: 4.2
          },
          {
            team_member_id: 'tm-5',
            team_member_name: 'Maria Garcia',
            role: 'Change Analyst',
            changes_handled: 26,
            avg_processing_time_hours: 7.8,
            quality_score: 92.8,
            workload_percentage: 72,
            efficiency_rating: 4.4
          }
        ],
        
        bottleneck_analysis: [
          {
            bottleneck_type: 'approval',
            description: 'Senior management approval delays for high-value changes',
            affected_changes: 18,
            avg_delay_days: 6.2,
            impact_severity: 'high',
            suggested_actions: [
              'Implement delegation authority for routine high-value changes',
              'Set up automated escalation after 3 days',
              'Create express approval track for urgent changes'
            ]
          },
          {
            bottleneck_type: 'analysis',
            description: 'Impact analysis backlog during peak periods',
            affected_changes: 12,
            avg_delay_days: 3.8,
            impact_severity: 'medium',
            suggested_actions: [
              'Add temporary impact analysis resources',
              'Implement analysis templates for common change types',
              'Cross-train team members on impact analysis'
            ]
          },
          {
            bottleneck_type: 'implementation',
            description: 'Resource conflicts during implementation phase',
            affected_changes: 8,
            avg_delay_days: 9.1,
            impact_severity: 'high',
            suggested_actions: [
              'Improve resource planning and allocation',
              'Create resource pool for change implementations',
              'Implement better scheduling coordination'
            ]
          },
          {
            bottleneck_type: 'communication',
            description: 'Stakeholder notification and response delays',
            affected_changes: 15,
            avg_delay_days: 2.3,
            impact_severity: 'low',
            suggested_actions: [
              'Automate more notification processes',
              'Set up reminder escalations',
              'Improve notification templates and clarity'
            ]
          }
        ],
        
        overall_approval_time_trend: [
          { date: '2024-01', avg_approval_time: 4.8, target_approval_time: 5.0, volume: 18 },
          { date: '2024-02', avg_approval_time: 5.1, target_approval_time: 5.0, volume: 22 },
          { date: '2024-03', avg_approval_time: 5.5, target_approval_time: 5.0, volume: 25 },
          { date: '2024-04', avg_approval_time: 5.2, target_approval_time: 5.0, volume: 28 },
          { date: '2024-05', avg_approval_time: 4.9, target_approval_time: 5.0, volume: 31 },
          { date: '2024-06', avg_approval_time: 5.3, target_approval_time: 5.0, volume: 32 }
        ],
        
        success_rate_trend: [
          { date: '2024-01', success_rate: 85.2, target_success_rate: 90.0, total_implementations: 15 },
          { date: '2024-02', success_rate: 87.8, target_success_rate: 90.0, total_implementations: 18 },
          { date: '2024-03', success_rate: 89.1, target_success_rate: 90.0, total_implementations: 22 },
          { date: '2024-04', success_rate: 91.3, target_success_rate: 90.0, total_implementations: 24 },
          { date: '2024-05', success_rate: 88.7, target_success_rate: 90.0, total_implementations: 27 },
          { date: '2024-06', success_rate: 90.5, target_success_rate: 90.0, total_implementations: 29 }
        ],
        
        workload_distribution: [
          { team_member: 'Alice Brown', current_workload: 28, capacity: 35, utilization_percentage: 80 },
          { team_member: 'David Lee', current_workload: 35, capacity: 40, utilization_percentage: 87.5 },
          { team_member: 'Emma Taylor', current_workload: 42, capacity: 45, utilization_percentage: 93.3 },
          { team_member: 'James Wilson', current_workload: 31, capacity: 40, utilization_percentage: 77.5 },
          { team_member: 'Maria Garcia', current_workload: 26, capacity: 35, utilization_percentage: 74.3 }
        ]
      }
      
      setPerformanceData(mockData)
      setLoading(false)
    }

    fetchPerformanceData()
  }, [projectId, dateRange, teamFilter])

  const handleRefresh = async () => {
    setRefreshing(true)
    // Simulate API call
    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }

  const handleExport = () => {
    if (performanceData) {
      const dataStr = JSON.stringify(performanceData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      
      const exportFileDefaultName = `performance-monitoring-${new Date().toISOString().split('T')[0]}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
    }
  }

  const handleBottleneckAction = (bottleneck: BottleneckAnalysis, action: string) => {
    if (onBottleneckAction) {
      onBottleneckAction(bottleneck, action)
    }
    console.log('Bottleneck action:', action, bottleneck)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-800 bg-red-100'
      case 'high': return 'text-orange-800 bg-orange-100'
      case 'medium': return 'text-yellow-800 bg-yellow-100'
      case 'low': return 'text-green-800 bg-green-100'
      default: return 'text-gray-800 bg-gray-100'
    }
  }

  const getPerformanceIcon = (score: number) => {
    if (score >= 4.5) return <ArrowUp className="h-4 w-4 text-green-600" />
    if (score >= 3.5) return <Minus className="h-4 w-4 text-yellow-600" />
    return <ArrowDown className="h-4 w-4 text-red-600" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" data-testid="loading-spinner"></div>
      </div>
    )
  }

  if (!performanceData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No performance data available</h3>
        <p className="mt-1 text-sm text-gray-500">
          Performance monitoring data could not be loaded for the selected criteria.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Performance Monitoring</h2>
            <p className="text-gray-600 mt-1">
              Approval time tracking, bottleneck identification, and team performance analysis
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'approval', label: 'Approval Times', icon: Clock },
              { id: 'success', label: 'Success Rates', icon: Target },
              { id: 'team', label: 'Team Performance', icon: Users },
              { id: 'bottlenecks', label: 'Bottlenecks', icon: AlertTriangle }
            ].map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id as any)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeView === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Approval Times Tab */}
          {activeView === 'approval' && (
            <div className="space-y-6">
              {/* Approval Time Trend */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Approval Time Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={performanceData.overall_approval_time_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="avg_approval_time" stroke="#EF4444" name="Actual Approval Time (days)" strokeWidth={3} />
                    <Line yAxisId="left" type="monotone" dataKey="target_approval_time" stroke="#10B981" name="Target Approval Time (days)" strokeWidth={2} strokeDasharray="5 5" />
                    <Bar yAxisId="right" dataKey="volume" fill="#3B82F6" name="Change Volume" opacity={0.6} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Approver Performance Table */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Approver Performance Analysis</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approver
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Approvals
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Time (hours)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Overdue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approval Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Bottleneck Score
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {performanceData.approval_time_metrics.map((approver, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {approver.approver_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {approver.total_approvals}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`${approver.avg_approval_time_hours > 24 ? 'text-red-600' : approver.avg_approval_time_hours > 12 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {approver.avg_approval_time_hours.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {approver.overdue_approvals > 0 ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                {approver.overdue_approvals}
                              </span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`${approver.approval_rate > 90 ? 'text-green-600' : approver.approval_rate > 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {approver.approval_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    approver.bottleneck_score > 3 ? 'bg-red-600' : 
                                    approver.bottleneck_score > 2 ? 'bg-yellow-600' : 'bg-green-600'
                                  }`}
                                  style={{ width: `${Math.min(100, (approver.bottleneck_score / 5) * 100)}%` }}
                                ></div>
                              </div>
                              <span className="ml-2 text-sm text-gray-600">
                                {approver.bottleneck_score.toFixed(1)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Success Rates Tab */}
          {activeView === 'success' && (
            <div className="space-y-6">
              {/* Success Rate Trend */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Implementation Success Rate Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={performanceData.success_rate_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="success_rate" stroke="#10B981" name="Actual Success Rate (%)" strokeWidth={3} />
                    <Line yAxisId="left" type="monotone" dataKey="target_success_rate" stroke="#EF4444" name="Target Success Rate (%)" strokeWidth={2} strokeDasharray="5 5" />
                    <Bar yAxisId="right" dataKey="total_implementations" fill="#3B82F6" name="Total Implementations" opacity={0.6} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Change Success Metrics by Type */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Success Metrics by Change Type</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Change Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Changes
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Success Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cost Variance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Schedule Variance
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Impact Accuracy
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {performanceData.change_success_metrics.map((metric, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                            {metric.change_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metric.total_changes}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              metric.success_rate > 90 ? 'bg-green-100 text-green-800' :
                              metric.success_rate > 80 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {metric.success_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`${metric.avg_cost_variance > 20 ? 'text-red-600' : metric.avg_cost_variance > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                              ±{metric.avg_cost_variance.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`${metric.avg_schedule_variance > 15 ? 'text-red-600' : metric.avg_schedule_variance > 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                              ±{metric.avg_schedule_variance.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    metric.impact_accuracy_score > 85 ? 'bg-green-600' : 
                                    metric.impact_accuracy_score > 75 ? 'bg-yellow-600' : 'bg-red-600'
                                  }`}
                                  style={{ width: `${metric.impact_accuracy_score}%` }}
                                ></div>
                              </div>
                              <span className="ml-2 text-sm text-gray-600">
                                {metric.impact_accuracy_score.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Team Performance Tab */}
          {activeView === 'team' && (
            <div className="space-y-6">
              {/* Workload Distribution */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Team Workload Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData.workload_distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="team_member" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="current_workload" fill="#3B82F6" name="Current Workload" />
                    <Bar dataKey="capacity" fill="#10B981" name="Capacity" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Team Performance Metrics */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Individual Performance Metrics</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Team Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Changes Handled
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Processing Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quality Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Workload %
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Efficiency
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {performanceData.team_performance_metrics.map((member, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {member.team_member_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.role}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.changes_handled}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {member.avg_processing_time_hours.toFixed(1)}h
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    member.quality_score > 95 ? 'bg-green-600' : 
                                    member.quality_score > 90 ? 'bg-yellow-600' : 'bg-red-600'
                                  }`}
                                  style={{ width: `${member.quality_score}%` }}
                                ></div>
                              </div>
                              <span className="ml-2 text-sm text-gray-600">
                                {member.quality_score.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              member.workload_percentage > 90 ? 'bg-red-100 text-red-800' :
                              member.workload_percentage > 80 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {member.workload_percentage}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getPerformanceIcon(member.efficiency_rating)}
                              <span className="ml-2 text-sm text-gray-600">
                                {member.efficiency_rating.toFixed(1)}/5.0
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Bottlenecks Tab */}
          {activeView === 'bottlenecks' && (
            <div className="space-y-6">
              {/* Bottleneck Analysis Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {performanceData.bottleneck_analysis.map((bottleneck, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-5 w-5 text-orange-600" />
                          <h3 className="text-lg font-medium text-gray-900 capitalize">
                            {bottleneck.bottleneck_type} Bottleneck
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(bottleneck.impact_severity)}`}>
                            {bottleneck.impact_severity}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-4">{bottleneck.description}</p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-500">Affected Changes</p>
                            <p className="text-lg font-semibold text-gray-900">{bottleneck.affected_changes}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Avg Delay</p>
                            <p className="text-lg font-semibold text-gray-900">{bottleneck.avg_delay_days.toFixed(1)} days</p>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-900 mb-2">Suggested Actions:</p>
                          <ul className="text-sm text-gray-600 space-y-1">
                            {bottleneck.suggested_actions.map((action, actionIndex) => (
                              <li key={actionIndex} className="flex items-start gap-2">
                                <span className="text-blue-600 mt-1">•</span>
                                {action}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleBottleneckAction(bottleneck, 'view_details')}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </button>
                          <button
                            onClick={() => handleBottleneckAction(bottleneck, 'create_action_plan')}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-300 rounded hover:bg-green-50"
                          >
                            <Target className="h-4 w-4" />
                            Create Action Plan
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottleneck Impact Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Bottleneck Impact Analysis</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart data={performanceData.bottleneck_analysis}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="affected_changes" name="Affected Changes" />
                    <YAxis dataKey="avg_delay_days" name="Average Delay (days)" />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label) => `Bottleneck: ${label}`}
                    />
                    <Scatter 
                      dataKey="avg_delay_days" 
                      fill="#EF4444"
                      name="Impact"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}