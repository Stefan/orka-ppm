'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  TrendingUp,
  Zap,
  Users,
  FileText,
  X,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  BarChart3
} from 'lucide-react'
import { AnomalyResult, AnomalyType } from '@/lib/costbook/anomaly-detection'
import { formatCurrency } from '@/lib/currency-utils'

export interface AnomalyDetailDialogProps {
  /** Anomaly to display */
  anomaly: AnomalyResult
  /** Project name for context */
  projectName?: string
  /** Whether dialog is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Action handlers */
  onAcknowledge?: (anomaly: AnomalyResult) => void
  onDismiss?: (anomaly: AnomalyResult) => void
  /** Test ID */
  'data-testid'?: string
}

/**
 * Get detailed information for anomaly type
 */
function getAnomalyDetails(type: AnomalyType) {
  const details = {
    [AnomalyType.VARIANCE_OUTLIER]: {
      title: 'Budget Variance Outlier',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      description: 'This project shows unusual budget variance compared to similar projects.',
      impact: 'High',
      causes: [
        'Unexpected cost increases',
        'Scope creep',
        'Vendor price changes',
        'Resource allocation issues'
      ]
    },
    [AnomalyType.SPEND_VELOCITY]: {
      title: 'High Spend Velocity',
      icon: <Zap className="w-6 h-6" />,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      description: 'This project is utilizing budget at an unusually high rate.',
      impact: 'Medium',
      causes: [
        'Accelerated timeline',
        'Bulk purchasing',
        'Rushed implementation',
        'Inefficient resource usage'
      ]
    },
    [AnomalyType.BUDGET_UTILIZATION_SPIKE]: {
      title: 'Budget Utilization Spike',
      icon: <BarChart3 className="w-6 h-6" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      description: 'Sudden increase in budget utilization compared to active projects.',
      impact: 'Medium',
      causes: [
        'New phase initiation',
        'Resource ramp-up',
        'Milestone payments',
        'Contract changes'
      ]
    },
    [AnomalyType.VENDOR_CONCENTRATION]: {
      title: 'Vendor Concentration Risk',
      icon: <Users className="w-6 h-6" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      description: 'High transaction volume may indicate vendor concentration risk.',
      impact: 'Low',
      causes: [
        'Single vendor dependency',
        'Bulk purchasing strategy',
        'Consolidated procurement',
        'Framework agreements'
      ]
    },
    [AnomalyType.UNUSUAL_COMMITMENT_PATTERN]: {
      title: 'Unusual Commitment Pattern',
      icon: <FileText className="w-6 h-6" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      description: 'Commitment pattern deviates from typical project behavior.',
      impact: 'Low',
      causes: [
        'Irregular procurement',
        'Budget adjustments',
        'Contract renegotiations',
        'Change orders'
      ]
    }
  }

  return details[type] || details[AnomalyType.VARIANCE_OUTLIER]
}

/**
 * Get severity information
 */
function getSeverityInfo(severity: 'low' | 'medium' | 'high' | 'critical') {
  const info = {
    critical: {
      label: 'Critical',
      color: 'text-red-700 bg-red-100',
      icon: <XCircle className="w-4 h-4" />,
      description: 'Immediate attention required'
    },
    high: {
      label: 'High',
      color: 'text-orange-700 bg-orange-100',
      icon: <AlertTriangle className="w-4 h-4" />,
      description: 'Close monitoring recommended'
    },
    medium: {
      label: 'Medium',
      color: 'text-yellow-700 bg-yellow-100',
      icon: <Clock className="w-4 h-4" />,
      description: 'Monitor periodically'
    },
    low: {
      label: 'Low',
      color: 'text-blue-700 bg-blue-100',
      icon: <Info className="w-4 h-4" />,
      description: 'Track for trends'
    }
  }

  return info[severity]
}

/**
 * AnomalyDetailDialog component
 */
export function AnomalyDetailDialog({
  anomaly,
  projectName,
  isOpen,
  onClose,
  onAcknowledge,
  onDismiss,
  'data-testid': testId = 'anomaly-detail-dialog'
}: AnomalyDetailDialogProps) {
  const [actionTaken, setActionTaken] = useState(false)

  if (!isOpen) return null

  const anomalyDetails = getAnomalyDetails(anomaly.anomalyType)
  const severityInfo = getSeverityInfo(anomaly.severity)

  const handleAcknowledge = () => {
    if (onAcknowledge) {
      onAcknowledge(anomaly)
      setActionTaken(true)
    }
  }

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss(anomaly)
      setActionTaken(true)
    }
  }

  const handleClose = () => {
    setActionTaken(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      data-testid={testId}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`p-6 ${anomalyDetails.bgColor} border-b ${anomalyDetails.borderColor}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${anomalyDetails.bgColor} border ${anomalyDetails.borderColor}`}>
                <span className={anomalyDetails.color}>
                  {anomalyDetails.icon}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {anomalyDetails.title}
                </h2>
                {projectName && (
                  <p className="text-sm text-gray-600 mt-1">
                    Project: {projectName}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Severity Badge */}
          <div className="mt-4 flex items-center gap-2">
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${severityInfo.color}`}>
              {severityInfo.icon}
              {severityInfo.label} Priority
            </div>
            <span className="text-sm text-gray-600">
              {severityInfo.description}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Description */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700">{anomaly.description}</p>
            <div className="mt-2 text-sm text-gray-600">
              <strong>Confidence:</strong> {(anomaly.confidence * 100).toFixed(1)}%
            </div>
          </div>

          {/* Details */}
          {anomaly.details && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Details</h3>
              <div className="grid grid-cols-2 gap-4">
                {anomaly.details.actualValue !== undefined && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Actual Value</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {typeof anomaly.details.actualValue === 'number'
                        ? formatCurrency(anomaly.details.actualValue)
                        : anomaly.details.actualValue
                      }
                    </div>
                  </div>
                )}

                {anomaly.details.expectedValue !== undefined && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Expected Value</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(anomaly.details.expectedValue)}
                    </div>
                  </div>
                )}

                {anomaly.details.deviation !== undefined && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Deviation</div>
                    <div className={`text-lg font-semibold ${anomaly.details.deviation > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(Math.abs(anomaly.details.deviation))}
                    </div>
                  </div>
                )}

                {anomaly.details.zScore !== undefined && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Z-Score</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {anomaly.details.zScore.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Impact & Causes */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Impact Level</div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  anomalyDetails.impact === 'High' ? 'bg-red-100 text-red-800' :
                  anomalyDetails.impact === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {anomalyDetails.impact}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Possible Causes</div>
                <ul className="text-sm text-gray-600 space-y-1">
                  {anomalyDetails.causes.slice(0, 3).map((cause, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          {anomaly.recommendation && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Recommendation</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">{anomaly.recommendation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Detected: {new Date().toLocaleDateString()}
          </div>

          {!actionTaken && (
            <div className="flex gap-3">
              {onDismiss && (
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  data-testid={`${testId}-dismiss`}
                >
                  Dismiss
                </button>
              )}

              {onAcknowledge && (
                <button
                  onClick={handleAcknowledge}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 transition-colors"
                  data-testid={`${testId}-acknowledge`}
                >
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Acknowledge
                </button>
              )}
            </div>
          )}

          {actionTaken && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Action recorded
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AnomalyDetailDialog