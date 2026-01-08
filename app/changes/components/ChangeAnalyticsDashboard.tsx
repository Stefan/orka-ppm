'use client'

import { useState } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { TrendingUp, Users, AlertTriangle, Activity, BarChart3, Download, RefreshCw, Info, Clock, CheckCircle, Filter, FileText, Zap } from 'lucide-react'
import PerformanceMonitoringInterface from './PerformanceMonitoringInterface'
import { ChangeAnalytics, mockDataService } from '../lib/mockData'
import { useAsyncData, LoadingState, SkeletonChart } from '../lib/loadingStates'

interface ChangeAnalyticsDashboardProps {
  projectId?: string
  dateRange: {
    from: Date
    to: Date
  }
  filters?: {
    changeType?: string
    priority?: string
    status?: string
  }
  onExport?: (data: any) => void
}

export default function ChangeAnalyticsDashboard({
  projectId,
  dateRange,
  filters = {},
  onExport
}: ChangeAnalyticsDashboardProps) {
  const [activeView, setActiveView] = useState<'overview' | 'performance' | 'trends' | 'projects' | 'impact'>('overview')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)

  // Use enhanced async data loading with loading states
  const {
    data: analyticsData,
    isLoading,
    isError,
    error,
    refetch
  } = useAsyncData<ChangeAnalytics>(
    () => Promise.resolve(mockDataService.getAnalytics()),
    [projectId, dateRange, filters]
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const handleExport = () => {
    if (onExport && analyticsData) {
      onExport(analyticsData)
    } else {
      // Default export functionality
      const dataStr = JSON.stringify(analyticsData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      
      const exportFileDefaultName = `change-analytics-${new Date().toISOString().split('T')[0]}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
    }
  }

  const handleDrillDown = (metric: string, value: any) => {
    setSelectedMetric(metric)
    // Implement drill-down functionality
    console.log('Drilling down into:', metric, value)
  }

  // Prepare chart data
  const statusData = analyticsData ? Object.entries(analyticsData.changes_by_status).map(([status, count]) => ({
    name: status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count,
    percentage: ((count / analyticsData.total_changes) * 100).toFixed(1)
  })) : []

  const typeData = analyticsData ? Object.entries(analyticsData.changes_by_type).map(([type, count]) => ({
    name: type.charAt(0).toUpperCase() + type.slice(1),
    value: count,
    percentage: ((count / analyticsData.total_changes) * 100).toFixed(1)
  })) : []

  const priorityData = analyticsData ? Object.entries(analyticsData.changes_by_priority).map(([priority, count]) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    value: count,
    percentage: ((count / analyticsData.total_changes) * 100).toFixed(1)
  })) : []

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316']

  return (
    <LoadingState
      state={isLoading ? 'loading' : isError ? 'error' : analyticsData ? 'success' : 'error'}
      message="Loading analytics data..."
      error={error || (!analyticsData ? 'No analytics data available' : '')}
      fallback={<SkeletonChart height="h-96" />}
    >
      {analyticsData && (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Change Analytics Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Executive dashboard with KPIs and trends for change management
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
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'performance', label: 'Performance', icon: Zap },
              { id: 'trends', label: 'Trends', icon: TrendingUp },
              { id: 'projects', label: 'Projects', icon: Users },
              { id: 'impact', label: 'Impact Analysis', icon: AlertTriangle }
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
          {/* Overview Tab */}
          {activeView === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div 
                  className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleDrillDown('total_changes', analyticsData.total_changes)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Total Changes</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {analyticsData.total_changes}
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div 
                  className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleDrillDown('approval_rate', analyticsData.approval_rate_percentage)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">Approval Rate</p>
                      <p className="text-2xl font-bold text-green-900">
                        {analyticsData.approval_rate_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <div 
                  className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleDrillDown('avg_approval_time', analyticsData.average_approval_time_days)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">Avg Approval Time</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {analyticsData.average_approval_time_days.toFixed(1)} days
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                </div>

                <div 
                  className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleDrillDown('avg_implementation_time', analyticsData.average_implementation_time_days)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-medium">Avg Implementation</p>
                      <p className="text-2xl font-bold text-purple-900">
                        {analyticsData.average_implementation_time_days.toFixed(1)} days
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Overview Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Changes by Status */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Changes by Status</h3>
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
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Changes by Type */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Changes by Type</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={typeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [value, 'Count']} />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Changes by Priority */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Changes by Priority</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }: any) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeView === 'performance' && (
            <PerformanceMonitoringInterface
              projectId={projectId || ''}
              dateRange={dateRange}
              teamFilter={[]}
              onBottleneckAction={(bottleneck, action) => {
                console.log('Bottleneck action from dashboard:', action, bottleneck)
              }}
            />
          )}

          {/* Trends Tab */}
          {activeView === 'trends' && (
            <div className="space-y-6">
              {/* Monthly Change Volume Trend */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Change Volume Trends</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={analyticsData.monthly_change_volume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="total_changes" fill="#3B82F6" name="Total Changes" />
                    <Bar yAxisId="left" dataKey="approved_changes" fill="#10B981" name="Approved Changes" />
                    <Line yAxisId="right" type="monotone" dataKey="avg_approval_time" stroke="#EF4444" name="Avg Approval Time (days)" strokeWidth={3} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Approval Rate Trend */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Approval Rate Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.monthly_change_volume}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value, name) => [value, name]} />
                    <Line 
                      type="monotone" 
                      dataKey="approved_changes" 
                      stroke="#10B981" 
                      strokeWidth={3}
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Projects Tab */}
          {activeView === 'projects' && (
            <div className="space-y-6">
              {/* Project Performance Table */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Project Change Performance</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Changes
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approved
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approval Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Cost Impact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Schedule Impact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analyticsData.changes_by_project.map((project, index) => (
                        <tr key={index} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleDrillDown('project', project)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {project.project_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {project.count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {Math.round(project.count * project.approval_rate / 100)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              project.approval_rate > 80 
                                ? 'bg-green-100 text-green-800' 
                                : project.approval_rate > 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {project.approval_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${project.average_cost_impact.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            N/A
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Project Change Volume Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Volume by Project</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analyticsData.changes_by_project}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="project_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_changes" fill="#3B82F6" name="Total Changes" />
                    <Bar dataKey="approved_changes" fill="#10B981" name="Approved Changes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Impact Analysis Tab */}
          {activeView === 'impact' && (
            <div className="space-y-6">
              {/* High Impact Changes */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">High Impact Changes</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Change Request
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Title
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cost Impact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Schedule Impact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Project
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analyticsData.high_impact_changes.map((change, index) => (
                        <tr key={index} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleDrillDown('change', change)}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                            {change.id}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {change.title}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${change.cost_impact.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {change.schedule_impact} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              change.status === 'approved' 
                                ? 'bg-green-100 text-green-800' 
                                : change.status === 'implementing'
                                ? 'bg-blue-100 text-blue-800'
                                : change.status === 'pending_approval'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {change.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            N/A
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Impact Distribution Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cost Impact Distribution */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Impact Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.high_impact_changes.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="change_number" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${(value as number).toLocaleString()}`, 'Cost Impact']} />
                      <Bar dataKey="cost_impact" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Schedule Impact Distribution */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule Impact Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.high_impact_changes.slice(0, 5)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="change_number" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} days`, 'Schedule Impact']} />
                      <Bar dataKey="schedule_impact_days" fill="#F59E0B" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Metadata */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-600">
              Analytics generated on {new Date().toLocaleString()} | 
              Date range: {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
              {projectId && ` | Project: ${projectId}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedMetric && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Drilling down: {selectedMetric}
              </span>
            )}
          </div>
        </div>
      </div>
      )}
    </LoadingState>
  )
}