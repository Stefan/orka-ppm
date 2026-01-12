'use client'

import { useState } from 'react'
import { BarChart, Bar, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { DollarSign, Calendar, Users, AlertTriangle, Target, Activity, BarChart3, Settings, Download, RefreshCw, Info } from 'lucide-react'
import { ImpactAnalysisData, mockDataService } from '../lib/mockData'
import { useAsyncData, SkeletonChart } from '../lib/loadingStates'

interface ImpactAnalysisDashboardProps {
  changeId: string
  impactData?: ImpactAnalysisData
  editable?: boolean
  onDataUpdate?: (data: ImpactAnalysisData) => void
}

export default function ImpactAnalysisDashboard({
  changeId,
  impactData: initialData,
  editable = false,
  onDataUpdate: _onDataUpdate
}: ImpactAnalysisDashboardProps) {
  const [activeView, setActiveView] = useState<'overview' | 'cost' | 'schedule' | 'resources' | 'risks' | 'scenarios'>('overview')
  const [refreshing, setRefreshing] = useState(false)

  // Use enhanced async data loading with loading states
  const {
    data: impactData,
    isLoading,
    isError,
    error,
    refetch
  } = useAsyncData<ImpactAnalysisData>(
    () => initialData ? Promise.resolve(initialData) : Promise.resolve(mockDataService.getImpactAnalysis(changeId)),
    [changeId, initialData]
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
    // Export functionality
    console.log('Exporting impact analysis data')
  }

  if (isLoading) {
    return <SkeletonChart height="h-96" />
  }

  if (isError || !impactData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">{error || 'No impact analysis available'}</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const costBreakdownData = Object.entries(impactData.cost_breakdown).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
    percentage: ((value / impactData.total_cost_impact) * 100).toFixed(1)
  }))

  const scenarioComparisonData = [
    {
      scenario: 'Best Case',
      cost: impactData.scenarios.best_case.cost_impact,
      schedule: impactData.scenarios.best_case.schedule_impact,
      probability: impactData.scenarios.best_case.probability * 100
    },
    {
      scenario: 'Most Likely',
      cost: impactData.scenarios.most_likely.cost_impact,
      schedule: impactData.scenarios.most_likely.schedule_impact,
      probability: impactData.scenarios.most_likely.probability * 100
    },
    {
      scenario: 'Worst Case',
      cost: impactData.scenarios.worst_case.cost_impact,
      schedule: impactData.scenarios.worst_case.schedule_impact,
      probability: impactData.scenarios.worst_case.probability * 100
    }
  ]

  const scheduleImpactData = impactData.affected_activities.map(activity => ({
    name: activity.name,
    original: activity.original_duration,
    new: activity.new_duration,
    delay: activity.delay_days
  }))

  const riskImpactData = [
    ...impactData.new_risks.map(risk => ({
      name: risk.description.substring(0, 30) + '...',
      type: 'New Risk',
      probability: risk.probability * 100,
      impact: risk.impact_score,
      mitigation: risk.mitigation_cost
    })),
    ...impactData.modified_risks.map(risk => ({
      name: risk.description.substring(0, 30) + '...',
      type: 'Modified Risk',
      probability: risk.new_probability * 100,
      impact: risk.new_impact,
      mitigation: 0
    }))
  ]

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Impact Analysis Dashboard</h2>
            <p className="text-gray-600 mt-1">
              Comprehensive impact analysis for change request {changeId}
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
            {editable && (
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                <Settings className="h-4 w-4" />
                Configure
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'cost', label: 'Cost Impact', icon: DollarSign },
              { id: 'schedule', label: 'Schedule Impact', icon: Calendar },
              { id: 'resources', label: 'Resources', icon: Users },
              { id: 'risks', label: 'Risk Impact', icon: AlertTriangle },
              { id: 'scenarios', label: 'Scenarios', icon: Target }
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
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Total Cost Impact</p>
                      <p className="text-2xl font-bold text-blue-900">
                        ${impactData.total_cost_impact.toLocaleString()}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">Schedule Impact</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {impactData.schedule_impact_days} days
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-orange-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-600 text-sm font-medium">Critical Path</p>
                      <p className="text-2xl font-bold text-red-900">
                        {impactData.critical_path_affected ? 'Affected' : 'Not Affected'}
                      </p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">New Risks</p>
                      <p className="text-2xl font-bold text-green-900">
                        {impactData.new_risks.length}
                      </p>
                    </div>
                    <Activity className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Overview Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cost Breakdown */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Breakdown</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={costBreakdownData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }: any) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {costBreakdownData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`$${(value || 0).toLocaleString()}`, 'Cost']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Scenario Comparison */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Scenario Comparison</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={scenarioComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="scenario" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="cost" fill="#3B82F6" name="Cost Impact ($)" />
                      <Line yAxisId="right" type="monotone" dataKey="schedule" stroke="#EF4444" name="Schedule Impact (days)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Cost Impact Tab */}
          {activeView === 'cost' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cost Summary */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Summary</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Direct Costs</span>
                      <span className="font-medium text-green-600">
                        ${impactData.direct_costs.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Indirect Costs</span>
                      <span className="font-medium text-orange-600">
                        ${impactData.indirect_costs.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Cost Savings</span>
                      <span className="font-medium text-blue-600">
                        ${impactData.cost_savings.toLocaleString()}
                      </span>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-900">Total Impact</span>
                        <span className="font-bold text-lg text-red-600">
                          ${impactData.total_cost_impact.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cost Breakdown Chart */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Detailed Cost Breakdown</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={costBreakdownData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`$${(value || 0).toLocaleString()}`, 'Cost']} />
                      <Bar dataKey="value" fill="#3B82F6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Impact Tab */}
          {activeView === 'schedule' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Impact Analysis</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={scheduleImpactData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="original" fill="#10B981" name="Original Duration (days)" />
                    <Bar dataKey="new" fill="#EF4444" name="New Duration (days)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Affected Activities</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Activity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Original Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          New Duration
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Delay
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Resource Impact
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {impactData.affected_activities.map((activity) => (
                        <tr key={activity.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {activity.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {activity.original_duration} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {activity.new_duration} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                            +{activity.delay_days} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {activity.resource_impact}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Resources Tab */}
          {activeView === 'resources' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Additional Resources */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Resources Needed</h3>
                  <div className="space-y-4">
                    {impactData.additional_resources_needed.map((resource, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900">{resource.resource_type}</h4>
                            <p className="text-sm text-gray-600">
                              Quantity: {resource.quantity} | Duration: {resource.duration_days} days
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              ${(resource.quantity * resource.cost_per_unit * resource.duration_days).toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">
                              ${resource.cost_per_unit}/day
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resource Reallocation */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Reallocation</h3>
                  <div className="space-y-4">
                    {impactData.resource_reallocation.map((reallocation, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{reallocation.resource_type}</h4>
                            <p className="text-sm text-gray-600">
                              Quantity: {reallocation.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded">
                              From: {reallocation.from_activity}
                            </span>
                            <span>→</span>
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                              To: {reallocation.to_activity}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Risk Impact Tab */}
          {activeView === 'risks' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Impact Analysis</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={riskImpactData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="probability" fill="#F59E0B" name="Probability (%)" />
                    <Bar dataKey="impact" fill="#EF4444" name="Impact ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* New Risks */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">New Risks Identified</h3>
                  <div className="space-y-4">
                    {impactData.new_risks.map((risk) => (
                      <div key={risk.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{risk.description}</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Probability:</span>
                            <p className="font-medium">{(risk.probability * 100).toFixed(0)}%</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Impact:</span>
                            <p className="font-medium">${risk.impact_score.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Mitigation:</span>
                            <p className="font-medium">${risk.mitigation_cost.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modified Risks */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Modified Existing Risks</h3>
                  <div className="space-y-4">
                    {impactData.modified_risks.map((risk) => (
                      <div key={risk.id} className="border border-gray-200 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{risk.description}</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Probability Change:</span>
                            <p className="font-medium">
                              {(risk.old_probability * 100).toFixed(0)}% → {(risk.new_probability * 100).toFixed(0)}%
                              <span className={`ml-2 ${risk.new_probability > risk.old_probability ? 'text-red-600' : 'text-green-600'}`}>
                                {risk.new_probability > risk.old_probability ? '↑' : '↓'}
                              </span>
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Impact Change:</span>
                            <p className="font-medium">
                              ${risk.old_impact.toLocaleString()} → ${risk.new_impact.toLocaleString()}
                              <span className={`ml-2 ${risk.new_impact > risk.old_impact ? 'text-red-600' : 'text-green-600'}`}>
                                {risk.new_impact > risk.old_impact ? '↑' : '↓'}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Scenarios Tab */}
          {activeView === 'scenarios' && (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Scenario Analysis</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={scenarioComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="scenario" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="cost" fill="#3B82F6" name="Cost Impact ($)" />
                    <Bar yAxisId="left" dataKey="schedule" fill="#EF4444" name="Schedule Impact (days)" />
                    <Line yAxisId="right" type="monotone" dataKey="probability" stroke="#10B981" name="Probability (%)" strokeWidth={3} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(impactData.scenarios).map(([scenarioName, scenario]) => (
                  <div key={scenarioName} className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 capitalize">
                      {scenarioName.replace('_', ' ')} Scenario
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cost Impact:</span>
                        <span className="font-medium">${scenario.cost_impact.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Schedule Impact:</span>
                        <span className="font-medium">{scenario.schedule_impact} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Probability:</span>
                        <span className="font-medium">{(scenario.probability * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Metadata */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-600">
              Analysis performed by {impactData.analyzed_by} on{' '}
              {new Date(impactData.analyzed_at).toLocaleString()}
            </span>
          </div>
          {editable && (
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Update Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}