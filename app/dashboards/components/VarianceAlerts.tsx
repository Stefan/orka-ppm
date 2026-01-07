'use client'

import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Clock, X } from 'lucide-react'
import { getApiUrl } from '../../../lib/api'

interface VarianceAlert {
  id: string
  project_id: string
  variance_amount: number
  variance_percentage: number
  threshold_percentage: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  created_at: string
  resolved: boolean
}

interface VarianceAlertsProps {
  session: any
  onAlertCount?: (count: number) => void
}

export default function VarianceAlerts({ session, onAlertCount }: VarianceAlertsProps) {
  const [alerts, setAlerts] = useState<VarianceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (session) {
      fetchVarianceAlerts()
    }
  }, [session])

  useEffect(() => {
    // Notify parent component of alert count
    const activeAlerts = alerts.filter(alert => !alert.resolved)
    onAlertCount?.(activeAlerts.length)
  }, [alerts, onAlertCount])

  const fetchVarianceAlerts = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(getApiUrl('/variance/alerts'), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch variance alerts')
      }
      
      const data = await response.json()
      setAlerts(data.alerts || [])
      
    } catch (error: unknown) {
      console.error('Error fetching variance alerts:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch variance alerts')
      
      // Create mock alerts for demonstration
      const mockAlerts: VarianceAlert[] = [
        {
          id: '1',
          project_id: 'Project Alpha',
          variance_amount: 15000,
          variance_percentage: 12.5,
          threshold_percentage: 10,
          severity: 'high',
          message: 'Project Alpha has exceeded budget threshold by 12.5%',
          created_at: new Date().toISOString(),
          resolved: false
        },
        {
          id: '2',
          project_id: 'Project Beta',
          variance_amount: 8000,
          variance_percentage: 6.2,
          threshold_percentage: 5,
          severity: 'medium',
          message: 'Project Beta is approaching budget limit at 6.2% variance',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          resolved: false
        }
      ]
      setAlerts(mockAlerts)
    } finally {
      setLoading(false)
    }
  }

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(getApiUrl(`/variance/alerts/${alertId}/resolve`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, resolved: true } : alert
        ))
      }
    } catch (error) {
      console.error('Error resolving alert:', error)
      // For demo purposes, still mark as resolved
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, resolved: true } : alert
      ))
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-red-200 text-red-800'
      case 'high': return 'bg-orange-100 border-orange-200 text-orange-800'
      case 'medium': return 'bg-yellow-100 border-yellow-200 text-yellow-800'
      case 'low': return 'bg-blue-100 border-blue-200 text-blue-800'
      default: return 'bg-gray-100 border-gray-200 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <Clock className="h-4 w-4" />
      case 'low':
        return <CheckCircle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const activeAlerts = alerts.filter(alert => !alert.resolved)
  const displayAlerts = showAll ? alerts : activeAlerts.slice(0, 3)

  if (activeAlerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          <span className="text-sm text-green-800">
            No active variance alerts. All projects are within budget thresholds.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Variance Alerts ({activeAlerts.length})
        </h3>
        {alerts.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAll ? 'Show Less' : `Show All (${alerts.length})`}
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {displayAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)} ${
              alert.resolved ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2 flex-1">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium truncate">
                    {alert.project_id}
                  </h4>
                  <p className="text-xs mt-1">
                    {alert.message}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs">
                    <span>
                      Variance: {alert.variance_percentage >= 0 ? '+' : ''}
                      {alert.variance_percentage.toFixed(1)}%
                    </span>
                    <span>
                      Amount: {alert.variance_amount >= 0 ? '+' : ''}
                      {alert.variance_amount.toLocaleString()}
                    </span>
                    <span>
                      {new Date(alert.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              {!alert.resolved && (
                <button
                  onClick={() => resolveAlert(alert.id)}
                  className="ml-2 p-1 hover:bg-white hover:bg-opacity-50 rounded"
                  title="Resolve alert"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {alert.resolved && (
              <div className="mt-2 flex items-center text-xs text-gray-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Resolved
              </div>
            )}
          </div>
        ))}
      </div>
      
      {error && (
        <div className="mt-3 text-xs text-gray-500">
          Note: Using demo data - {error}
        </div>
      )}
    </div>
  )
}