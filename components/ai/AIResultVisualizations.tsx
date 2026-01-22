import React from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { AlertTriangle, CheckCircle, AlertCircle, Info, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatPercentage, formatHours, formatNumber } from '@/lib/utils/formatting'

// Types for AI agent responses
interface ResourceRecommendation {
  resource_id: string
  resource_name: string
  project_id: string
  project_name: string
  allocated_hours: number
  cost_savings: number
  confidence: number
}

interface RiskForecast {
  period: string
  risk_probability: number
  risk_impact: number
  confidence_lower: number
  confidence_upper: number
}

interface ValidationIssue {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  category: string
  entity_type: string
  entity_id: string
  description: string
  recommendation?: string
}

// Confidence Score Badge Component
export const ConfidenceBadge: React.FC<{ confidence: number; className?: string }> = ({ 
  confidence, 
  className = '' 
}) => {
  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 border-green-300'
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-red-100 text-red-800 border-red-300'
  }

  const getConfidenceLabel = (score: number) => {
    if (score >= 0.8) return 'High'
    if (score >= 0.6) return 'Medium'
    return 'Low'
  }

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getConfidenceColor(confidence)} ${className}`}
    >
      {getConfidenceLabel(confidence)} ({formatPercentage(confidence, 0)})
    </span>
  )
}

// Resource Optimizer Visualization
export const ResourceOptimizerChart: React.FC<{
  recommendations: ResourceRecommendation[]
  totalCostSavings: number
  modelConfidence: number
}> = ({ recommendations, totalCostSavings, modelConfidence }) => {
  const chartData = recommendations.map(rec => ({
    name: rec.resource_name,
    hours: rec.allocated_hours,
    savings: rec.cost_savings,
    confidence: rec.confidence * 100
  }))

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Resource Optimization Results</h3>
        <ConfidenceBadge confidence={modelConfidence} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Total Cost Savings</span>
            <TrendingDown className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalCostSavings)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Recommendations</span>
            <Info className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {recommendations.length}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Resource Allocation (Hours)</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="hours" fill="#3B82F6" name="Allocated Hours" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Cost Savings by Resource</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, savings }) => `${name}: ${formatCurrency(savings)}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="savings"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Detailed Recommendations</h4>
        <div className="space-y-2">
          {recommendations.map((rec, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{rec.resource_name}</div>
                <div className="text-sm text-gray-600">
                  {rec.project_name} • {formatHours(rec.allocated_hours)} • {formatCurrency(rec.cost_savings)} savings
                </div>
              </div>
              <ConfidenceBadge confidence={rec.confidence} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Risk Forecaster Visualization
export const RiskForecastChart: React.FC<{
  forecasts: RiskForecast[]
  modelConfidence: number
}> = ({ forecasts, modelConfidence }) => {
  const chartData = forecasts.map(forecast => ({
    period: forecast.period,
    probability: forecast.risk_probability * 100,
    impact: forecast.risk_impact,
    lower: forecast.confidence_lower * 100,
    upper: forecast.confidence_upper * 100
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Risk Forecast</h3>
        <ConfidenceBadge confidence={modelConfidence} />
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Risk Probability Over Time</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis label={{ value: 'Probability (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="probability" 
              stroke="#EF4444" 
              strokeWidth={2}
              name="Risk Probability"
              dot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="lower" 
              stroke="#F59E0B" 
              strokeDasharray="5 5"
              name="Lower Bound"
            />
            <Line 
              type="monotone" 
              dataKey="upper" 
              stroke="#F59E0B" 
              strokeDasharray="5 5"
              name="Upper Bound"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-4">Risk Impact Forecast</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis label={{ value: 'Impact Score', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="impact" fill="#EF4444" name="Risk Impact" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Forecast Details</h4>
        <div className="space-y-2">
          {forecasts.map((forecast, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{forecast.period}</div>
                <div className="text-sm text-gray-600">
                  Probability: {formatPercentage(forecast.risk_probability)} • 
                  Impact: {formatNumber(forecast.risk_impact, 1)} • 
                  Range: {formatPercentage(forecast.confidence_lower)} - {formatPercentage(forecast.confidence_upper)}
                </div>
              </div>
              {forecast.risk_probability > 0.7 && (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Data Validator Visualization
export const ValidationIssuesDisplay: React.FC<{
  issues: ValidationIssue[]
  totalIssues: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
}> = ({ issues, totalIssues, criticalCount, highCount, mediumCount, lowCount }) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'HIGH':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />
      case 'MEDIUM':
        return <Info className="w-5 h-5 text-yellow-600" />
      case 'LOW':
        return <CheckCircle className="w-5 h-5 text-blue-600" />
      default:
        return <Info className="w-5 h-5 text-gray-600" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-50 border-red-200'
      case 'HIGH':
        return 'bg-orange-50 border-orange-200'
      case 'MEDIUM':
        return 'bg-yellow-50 border-yellow-200'
      case 'LOW':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const summaryData = [
    { name: 'Critical', value: criticalCount, color: '#DC2626' },
    { name: 'High', value: highCount, color: '#EA580C' },
    { name: 'Medium', value: mediumCount, color: '#CA8A04' },
    { name: 'Low', value: lowCount, color: '#2563EB' }
  ].filter(item => item.value > 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Data Validation Results</h3>
        <span className="text-sm text-gray-600">{totalIssues} issues found</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-red-900">Critical</span>
            <AlertCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-orange-900">High</span>
            <AlertTriangle className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-bold text-orange-600">{highCount}</div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-yellow-900">Medium</span>
            <Info className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-yellow-600">{mediumCount}</div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-blue-900">Low</span>
            <CheckCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{lowCount}</div>
        </div>
      </div>

      {summaryData.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-4">Issues by Severity</h4>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={summaryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {summaryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Issue Details</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {issues.map((issue, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(issue.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-semibold text-gray-900">{issue.severity}</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-600">{issue.category}</span>
                    <span className="text-xs text-gray-600">•</span>
                    <span className="text-xs text-gray-600">{issue.entity_type}</span>
                  </div>
                  <p className="text-sm text-gray-900 mb-1">{issue.description}</p>
                  {issue.recommendation && (
                    <p className="text-xs text-gray-600 italic">
                      Recommendation: {issue.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
