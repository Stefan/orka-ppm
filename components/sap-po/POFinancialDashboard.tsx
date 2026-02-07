'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  DollarSign,
  Activity,
  Target,
  Settings,
  Bell,
  BellOff,
  Info
} from 'lucide-react'
import InteractiveChart from '../charts/InteractiveChart'
import { cn } from '@/lib/design-system'
import { getApiUrl } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'

/**
 * Variance Data Interface
 */
interface VarianceData {
  planned_vs_actual: number
  planned_vs_committed: number
  committed_vs_actual: number
  variance_percentage: number
  variance_status: 'on_track' | 'minor_variance' | 'significant_variance' | 'critical_variance'
  trend_direction: 'improving' | 'stable' | 'deteriorating'
}

/**
 * Budget Alert Interface
 */
interface BudgetAlert {
  id: string
  breakdown_id: string
  breakdown_name: string
  alert_type: 'budget_exceeded' | 'commitment_exceeded' | 'negative_variance' | 'trend_deteriorating'
  severity: 'low' | 'medium' | 'high' | 'critical'
  threshold_exceeded: number
  current_variance: number
  message: string
  recommended_actions: string[]
  created_at: string
}

/**
 * Financial Summary Interface
 */
interface FinancialSummary {
  total_planned: number
  total_committed: number
  total_actual: number
  total_remaining: number
  variance_amount: number
  variance_percentage: number
  currency: string
  by_category: Record<string, {
    planned: number
    actual: number
    variance: number
  }>
  by_status: Record<string, number>
}

/**
 * Threshold Configuration Interface
 */
interface ThresholdConfig {
  warning_threshold: number
  critical_threshold: number
  enable_notifications: boolean
  notification_email?: string
}

/**
 * Component Props
 */
export interface POFinancialDashboardProps {
  projectId: string
  financialSummary: FinancialSummary
  varianceData: VarianceData
  budgetAlerts: BudgetAlert[]
  onThresholdUpdate?: (config: ThresholdConfig) => void
  onAlertDismiss?: (alertId: string) => void
  className?: string
}

/**
 * POFinancialDashboard Component
 * 
 * Variance visualization with charts and trend analysis.
 * Budget alert display and threshold configuration interface.
 * 
 * Requirements: 3.4, 3.5, 5.6
 */
export const POFinancialDashboard: React.FC<POFinancialDashboardProps> = ({
  projectId,
  financialSummary,
  varianceData,
  budgetAlerts,
  onThresholdUpdate,
  onAlertDismiss,
  className = ''
}) => {
  const [showThresholdConfig, setShowThresholdConfig] = useState(false)
  const [thresholdConfig, setThresholdConfig] = useState<ThresholdConfig>({
    warning_threshold: 10,
    critical_threshold: 20,
    enable_notifications: true
  })
  const [selectedAlert, setSelectedAlert] = useState<BudgetAlert | null>(null)

  // Load threshold config from API
  useEffect(() => {
    const loadThresholdConfig = async () => {
      try {
        const response = await fetch(getApiUrl(`/api/v1/projects/${projectId}/po-threshold-config`))
        if (response.ok) {
          const config = await response.json()
          setThresholdConfig(config)
        }
      } catch (error) {
        console.error('Failed to load threshold config:', error)
      }
    }
    loadThresholdConfig()
  }, [projectId])

  // Prepare chart data for variance visualization
  const varianceChartData = useMemo(() => {
    return Object.entries(financialSummary.by_category).map(([category, data]) => ({
      name: category,
      planned: data.planned,
      actual: data.actual,
      variance: data.variance,
      variancePercentage: ((data.variance / data.planned) * 100).toFixed(1)
    }))
  }, [financialSummary])

  // Prepare trend data
  const trendChartData = useMemo(() => {
    return [
      { name: 'Planned', value: financialSummary.total_planned },
      { name: 'Committed', value: financialSummary.total_committed },
      { name: 'Actual', value: financialSummary.total_actual },
      { name: 'Remaining', value: financialSummary.total_remaining }
    ]
  }, [financialSummary])

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical_variance':
        return 'text-red-600 dark:text-red-400 bg-red-50 border-red-200 dark:border-red-800'
      case 'significant_variance':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 border-orange-200'
      case 'minor_variance':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 border-yellow-200 dark:border-yellow-800'
      case 'on_track':
        return 'text-green-600 dark:text-green-400 bg-green-50 border-green-200 dark:border-green-800'
      default:
        return 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'
    }
  }

  // Get alert severity color
  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300'
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-300'
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300'
      case 'low':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300'
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border-gray-300 dark:border-slate-600'
    }
  }

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
      case 'deteriorating':
        return <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
      default:
        return <Activity className="h-5 w-5 text-gray-600 dark:text-slate-400" />
    }
  }

  // Handle threshold save
  const handleThresholdSave = () => {
    onThresholdUpdate?.(thresholdConfig)
    setShowThresholdConfig(false)
  }

  // Critical alerts count
  const criticalAlertsCount = budgetAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Planned */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-slate-400">Total Planned</span>
            <Target className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {financialSummary.currency} {financialSummary.total_planned.toLocaleString()}
          </div>
        </div>

        {/* Total Actual */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-slate-400">Total Actual</span>
            <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {financialSummary.currency} {financialSummary.total_actual.toLocaleString()}
          </div>
        </div>

        {/* Variance */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-slate-400">Variance</span>
            {getTrendIcon(varianceData.trend_direction)}
          </div>
          <div className={cn(
            'text-2xl font-bold',
            financialSummary.variance_amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          )}>
            {financialSummary.variance_amount > 0 ? '+' : ''}
            {financialSummary.variance_percentage.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            {financialSummary.currency} {Math.abs(financialSummary.variance_amount).toLocaleString()}
          </div>
        </div>

        {/* Status */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-slate-400">Status</span>
            <AlertTriangle className={cn(
              'h-4 w-4',
              varianceData.variance_status === 'critical_variance' ? 'text-red-500 dark:text-red-400' :
              varianceData.variance_status === 'significant_variance' ? 'text-orange-500' :
              varianceData.variance_status === 'minor_variance' ? 'text-yellow-500 dark:text-yellow-400' :
              'text-green-500 dark:text-green-400'
            )} />
          </div>
          <div className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
            getStatusColor(varianceData.variance_status)
          )}>
            {varianceData.variance_status.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Budget Alerts - Req 3.5, 5.6 */}
      {budgetAlerts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Budget Alerts
                {criticalAlertsCount > 0 && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                    {criticalAlertsCount} Critical
                  </span>
                )}
              </h3>
            </div>
            <button
              onClick={() => setShowThresholdConfig(true)}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium"
            >
              <Settings className="h-4 w-4" />
              Configure Thresholds
            </button>
          </div>

          <div className="space-y-3">
            {budgetAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'p-4 rounded-lg border cursor-pointer transition-colors hover:shadow-md',
                  getAlertSeverityColor(alert.severity)
                )}
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{alert.breakdown_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm mb-2">{alert.message}</p>
                    <div className="flex items-center gap-4 text-xs">
                      <span>Variance: {alert.current_variance.toFixed(1)}%</span>
                      <span>Threshold: {alert.threshold_exceeded.toFixed(1)}%</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onAlertDismiss?.(alert.id)
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:text-slate-400"
                  >
                    <BellOff className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {budgetAlerts.length > 5 && (
              <button className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium py-2">
                View all {budgetAlerts.length} alerts
              </button>
            )}
          </div>
        </div>
      )}

      {/* Variance Visualization - Req 3.4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Variance by Category Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Variance by Category</h3>
          <InteractiveChart
            type="bar"
            data={varianceChartData}
            dataKey="variance"
            nameKey="name"
            colors={varianceChartData.map(d => 
              d.variance > 0 ? '#EF4444' : '#10B981'
            )}
            height={300}
            enableDrillDown={false}
            enableFiltering={false}
            showLegend={false}
          />
        </div>

        {/* Financial Overview Chart */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Financial Overview</h3>
          <InteractiveChart
            type="bar"
            data={trendChartData}
            dataKey="value"
            nameKey="name"
            colors={['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B']}
            height={300}
            enableDrillDown={false}
            enableFiltering={false}
            showLegend={false}
          />
        </div>
      </div>

      {/* Trend Analysis - Req 3.4 */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Trend Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={cn(
            'p-4 rounded-lg border',
            varianceData.trend_direction === 'improving' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
            varianceData.trend_direction === 'deteriorating' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
            'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'
          )}>
            <div className="flex items-center gap-2 mb-2">
              {getTrendIcon(varianceData.trend_direction)}
              <span className="font-medium text-gray-900 dark:text-slate-100">Trend Direction</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 capitalize">
              {varianceData.trend_direction}
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="font-medium text-gray-900 dark:text-slate-100">Planned vs Actual</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {varianceData.planned_vs_actual.toFixed(1)}% variance
            </p>
          </div>

          <div className="p-4 rounded-lg border bg-purple-50 border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-gray-900 dark:text-slate-100">Committed vs Actual</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {varianceData.committed_vs_actual.toFixed(1)}% variance
            </p>
          </div>
        </div>
      </div>

      {/* Threshold Configuration Modal */}
      {showThresholdConfig && (
        <Modal
          isOpen={showThresholdConfig}
          onClose={() => setShowThresholdConfig(false)}
          title="Configure Budget Alert Thresholds"
          size="md"
        >
          <div className="space-y-6 pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Warning Threshold (%)
              </label>
              <input
                type="number"
                value={thresholdConfig.warning_threshold}
                onChange={(e) => setThresholdConfig(prev => ({
                  ...prev,
                  warning_threshold: parseFloat(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                max="100"
                step="1"
              />
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Generate warning alerts when variance exceeds this percentage
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Critical Threshold (%)
              </label>
              <input
                type="number"
                value={thresholdConfig.critical_threshold}
                onChange={(e) => setThresholdConfig(prev => ({
                  ...prev,
                  critical_threshold: parseFloat(e.target.value)
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0"
                max="100"
                step="1"
              />
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                Generate critical alerts when variance exceeds this percentage
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={thresholdConfig.enable_notifications}
                  onChange={(e) => setThresholdConfig(prev => ({
                    ...prev,
                    enable_notifications: e.target.checked
                  }))}
                  className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Enable email notifications
                </span>
              </label>
            </div>

            {thresholdConfig.enable_notifications && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Notification Email
                </label>
                <input
                  type="email"
                  value={thresholdConfig.notification_email || ''}
                  onChange={(e) => setThresholdConfig(prev => ({
                    ...prev,
                    notification_email: e.target.value
                  }))}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setShowThresholdConfig(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleThresholdSave}
            >
              Save Configuration
            </Button>
          </ModalFooter>
        </Modal>
      )}

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <Modal
          isOpen={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          title="Alert Details"
          size="md"
        >
          <div className="space-y-4 pt-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">PO Breakdown Item</h4>
              <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{selectedAlert.breakdown_name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Alert Type</h4>
                <p className="text-sm text-gray-900 dark:text-slate-100 capitalize">
                  {selectedAlert.alert_type.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Severity</h4>
                <span className={cn(
                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
                  getAlertSeverityColor(selectedAlert.severity)
                )}>
                  {selectedAlert.severity}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Message</h4>
              <p className="text-sm text-gray-900 dark:text-slate-100">{selectedAlert.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Current Variance</h4>
                <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                  {selectedAlert.current_variance.toFixed(1)}%
                </p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Threshold Exceeded</h4>
                <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {selectedAlert.threshold_exceeded.toFixed(1)}%
                </p>
              </div>
            </div>

            {selectedAlert.recommended_actions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Recommended Actions</h4>
                <ul className="space-y-2">
                  {selectedAlert.recommended_actions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
                      <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <ModalFooter>
            <Button
              variant="secondary"
              onClick={() => setSelectedAlert(null)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onAlertDismiss?.(selectedAlert.id)
                setSelectedAlert(null)
              }}
            >
              Dismiss Alert
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}

export default POFinancialDashboard
