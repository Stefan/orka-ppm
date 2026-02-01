'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Star,
  BarChart3,
  Loader2
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import {
  VendorWithMetrics,
  VendorPerformanceHistory,
  VendorProject,
  VENDOR_RATING_CONFIG
} from '@/types/vendor'
import {
  fetchVendorHistory,
  getVendorRatingConfig,
  formatScore,
  formatPercentage
} from '@/lib/vendor-scoring'

export interface VendorDetailViewProps {
  /** Vendor to display */
  vendor: VendorWithMetrics
  /** Whether dialog is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    year: 'numeric' 
  })
}

/**
 * Format currency
 */
function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

/**
 * Metric card component
 */
function MetricCard({
  label,
  value,
  icon: Icon,
  color = 'text-gray-900',
  subValue
}: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: string
  subValue?: string
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-lg font-semibold ${color}`}>
        {value}
      </div>
      {subValue && (
        <div className="text-xs text-gray-400">{subValue}</div>
      )}
    </div>
  )
}

/**
 * Trend indicator
 */
function TrendIndicator({ trend }: { trend: 'improving' | 'stable' | 'declining' }) {
  const config = {
    improving: { icon: TrendingUp, color: 'text-green-600', label: 'Improving' },
    stable: { icon: Minus, color: 'text-gray-500', label: 'Stable' },
    declining: { icon: TrendingDown, color: 'text-red-600', label: 'Declining' }
  }
  
  const { icon: Icon, color, label } = config[trend]
  
  return (
    <span className={`flex items-center gap-1 text-sm ${color}`}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  )
}

/**
 * Vendor Detail View component
 */
export function VendorDetailView({
  vendor,
  isOpen,
  onClose,
  className = ''
}: VendorDetailViewProps) {
  const [history, setHistory] = useState<VendorPerformanceHistory | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'projects'>('overview')
  
  const ratingConfig = getVendorRatingConfig(vendor.score.rating)
  
  // Load history when dialog opens
  useEffect(() => {
    if (isOpen && activeTab === 'history' && !history) {
      loadHistory()
    }
  }, [isOpen, activeTab])
  
  const loadHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await fetchVendorHistory(vendor.id)
      setHistory(data)
    } catch (err) {
      console.error('Error loading vendor history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }
  
  // Chart data
  const chartData = useMemo(() => {
    if (!history?.history) return []
    return history.history.map(h => ({
      date: formatDate(h.date),
      score: h.overall_score,
      onTime: h.on_time_delivery_rate,
      quality: h.quality_score
    }))
  }, [history])
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className={`
        relative bg-white rounded-xl shadow-xl
        w-full max-w-2xl max-h-[85vh]
        flex flex-col overflow-hidden
        animate-in zoom-in-95 duration-200
        ${className}
      `}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {/* Rating badge */}
            <div className={`
              w-16 h-16 rounded-xl flex items-center justify-center
              text-2xl font-bold
              ${ratingConfig.bgColor} ${ratingConfig.color}
            `}>
              {vendor.score.rating}
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {vendor.name}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-500 capitalize">
                  {vendor.category}
                </span>
                <span className={`
                  px-2 py-0.5 rounded-full text-xs font-medium capitalize
                  ${vendor.status === 'active' 
                    ? 'bg-green-100 text-green-700' 
                    : vendor.status === 'suspended'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }
                `}>
                  {vendor.status}
                </span>
              </div>
            </div>
          </div>
          
          {/* Score */}
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {formatScore(vendor.score.overall_score)}
            </div>
            <div className="text-sm text-gray-500">Overall Score</div>
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {(['overview', 'history', 'projects'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-3 text-sm font-medium capitalize transition-colors
                ${activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard
                  label="On-Time Delivery"
                  value={`${vendor.score.on_time_delivery_rate}%`}
                  icon={Clock}
                  color={vendor.score.on_time_delivery_rate >= 90 ? 'text-green-600' : 
                         vendor.score.on_time_delivery_rate >= 75 ? 'text-yellow-600' : 'text-red-600'}
                />
                <MetricCard
                  label="Cost Variance"
                  value={formatPercentage(vendor.score.cost_variance_percentage)}
                  icon={DollarSign}
                  color={Math.abs(vendor.score.cost_variance_percentage) <= 5 ? 'text-green-600' : 
                         Math.abs(vendor.score.cost_variance_percentage) <= 10 ? 'text-yellow-600' : 'text-red-600'}
                />
                <MetricCard
                  label="Quality Score"
                  value={vendor.score.quality_score}
                  icon={Star}
                  color={vendor.score.quality_score >= 85 ? 'text-green-600' : 
                         vendor.score.quality_score >= 70 ? 'text-yellow-600' : 'text-red-600'}
                />
                <MetricCard
                  label="Response Time"
                  value={vendor.score.response_time_score}
                  icon={BarChart3}
                  color={vendor.score.response_time_score >= 85 ? 'text-green-600' : 
                         vendor.score.response_time_score >= 70 ? 'text-yellow-600' : 'text-red-600'}
                />
              </div>
              
              {/* Performance summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Performance Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Projects Completed:</span>
                    <span className="ml-2 font-medium">{vendor.score.projects_completed}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Contract Value:</span>
                    <span className="ml-2 font-medium">{formatCurrency(vendor.score.total_contract_value)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Deliveries (on-time/total):</span>
                    <span className="ml-2 font-medium">
                      {vendor.metrics.total_deliveries - vendor.metrics.late_deliveries}/{vendor.metrics.total_deliveries}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Quality Issues:</span>
                    <span className="ml-2 font-medium">{vendor.metrics.quality_issues}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Response Time:</span>
                    <span className="ml-2 font-medium">{vendor.metrics.avg_response_time_hours.toFixed(1)}h</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Avg Delivery Days:</span>
                    <span className="ml-2 font-medium">{vendor.metrics.avg_delivery_days}</span>
                  </div>
                </div>
              </div>
              
              {/* Contact info */}
              {(vendor.contact_email || vendor.contact_phone || vendor.address) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    {vendor.contact_email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <a href={`mailto:${vendor.contact_email}`} className="hover:text-blue-600">
                          {vendor.contact_email}
                        </a>
                      </div>
                    )}
                    {vendor.contact_phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        {vendor.contact_phone}
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {vendor.address}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Rating explanation */}
              <div className={`rounded-lg p-4 border ${ratingConfig.bgColor} border-current/20`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xl font-bold ${ratingConfig.color}`}>
                    {vendor.score.rating} - {ratingConfig.label}
                  </span>
                </div>
                <p className={`text-sm ${ratingConfig.color} opacity-80`}>
                  {ratingConfig.description}
                </p>
              </div>
            </div>
          )}
          
          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : history ? (
                <>
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {history.last_12_months_avg.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">12-Month Avg</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className={`text-2xl font-bold ${
                        history.year_over_year_change > 0 ? 'text-green-600' : 
                        history.year_over_year_change < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {history.year_over_year_change > 0 ? '+' : ''}{history.year_over_year_change.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500">YoY Change</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <TrendIndicator trend={history.trend} />
                      <div className="text-xs text-gray-500 mt-1">Trend</div>
                    </div>
                  </div>
                  
                  {/* Performance chart */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Performance Over Time</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                          />
                          <YAxis 
                            domain={[0, 100]}
                            tick={{ fontSize: 11, fill: '#6b7280' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '8px', 
                              border: '1px solid #e5e7eb' 
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="score"
                            name="Overall"
                            stroke="#3b82f6"
                            fill="#3b82f6"
                            fillOpacity={0.1}
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="onTime"
                            name="On-Time"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.1}
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="quality"
                            name="Quality"
                            stroke="#f59e0b"
                            fill="#f59e0b"
                            fillOpacity={0.1}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  Failed to load performance history
                </div>
              )}
            </div>
          )}
          
          {/* Projects Tab */}
          {activeTab === 'projects' && (
            <div className="space-y-4">
              {vendor.projects && vendor.projects.length > 0 ? (
                vendor.projects.map(project => (
                  <div 
                    key={project.project_id}
                    className="bg-gray-50 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{project.project_name}</h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date).toLocaleDateString()}
                          </span>
                          <span className={`
                            px-2 py-0.5 rounded-full capitalize
                            ${project.status === 'completed' 
                              ? 'bg-green-100 text-green-700' 
                              : project.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }
                          `}>
                            {project.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      
                      {/* On-time badge */}
                      {project.status === 'completed' && (
                        <span className={`
                          flex items-center gap-1 text-xs px-2 py-1 rounded-full
                          ${project.on_time 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                          }
                        `}>
                          {project.on_time ? (
                            <><CheckCircle2 className="w-3 h-3" /> On Time</>
                          ) : (
                            <><AlertTriangle className="w-3 h-3" /> Delayed</>
                          )}
                        </span>
                      )}
                    </div>
                    
                    {/* Financials */}
                    <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
                      <div>
                        <span className="text-gray-500">Contract:</span>
                        <span className="ml-1 font-medium">{formatCurrency(project.contract_value)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Actual:</span>
                        <span className="ml-1 font-medium">{formatCurrency(project.actual_cost)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Variance:</span>
                        <span className={`ml-1 font-medium ${
                          project.variance >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {project.variance >= 0 ? '+' : ''}{formatCurrency(project.variance)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Quality rating if available */}
                    {project.quality_rating !== undefined && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                        <Star className="w-3 h-3 text-yellow-500" />
                        Quality: {project.quality_rating.toFixed(1)}/5
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No project history available</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Last updated: {new Date(vendor.score.last_updated).toLocaleDateString()}</span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default VendorDetailView
