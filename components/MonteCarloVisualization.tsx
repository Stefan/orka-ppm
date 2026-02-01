'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Download, RefreshCw, Settings, AlertTriangle } from 'lucide-react'
import { getApiUrl } from '../lib/api/client'
import { ImageWithStabilizedLayout } from './ui/LayoutStabilizer'

interface MonteCarloChart {
  title: string
  subtitle?: string
  base64_image: string
  metadata: Record<string, any>
}

interface MonteCarloVisualizationProps {
  simulationId: string
  session: any
  onError?: (error: string) => void
}

interface ChartConfig {
  chart_types: string[]
  outcome_type: 'cost' | 'schedule'
  format: 'png' | 'pdf' | 'svg' | 'html'
  theme: 'default' | 'professional' | 'presentation' | 'colorblind_friendly'
  include_risk_heat_map: boolean
}

export default function MonteCarloVisualization({ 
  simulationId, 
  session, 
  onError 
}: MonteCarloVisualizationProps) {
  const [charts, setCharts] = useState<Record<string, MonteCarloChart>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [config, setConfig] = useState<ChartConfig>({
    chart_types: ['distribution', 'tornado', 'cdf'],
    outcome_type: 'cost',
    format: 'png',
    theme: 'professional',
    include_risk_heat_map: false
  })
  const [showSettings, setShowSettings] = useState(false)

  const generateCharts = async () => {
    if (!session?.access_token) {
      setError('Authentication required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        getApiUrl(`/api/v1/monte-carlo/simulations/${simulationId}/visualizations/generate`),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config)  // Remove simulation_id from body, it's in the path
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Monte Carlo visualization error:', response.status, errorData)

        const detail = errorData.detail
        const detailMsg = Array.isArray(detail)
          ? detail
              .map((d: { msg?: string; loc?: (string | number)[] }) => {
                const loc = Array.isArray(d.loc) ? d.loc.filter((x): x is string => typeof x === 'string').join('.') : ''
                return loc ? `${loc}: ${d.msg || ''}` : (d.msg || '')
              })
              .filter(Boolean)
              .join('; ')
          : typeof detail === 'string'
            ? detail
            : null

        if (response.status === 404) {
          const msg = typeof errorData.detail === 'string' ? errorData.detail : 'Simulation results not found. Run a simulation first to generate charts.'
          setError(msg)
          setLoading(false)
          return
        }
        if (response.status === 503) {
          const msg = typeof errorData.detail === 'string' ? errorData.detail : 'Visualization service unavailable. Start the backend (e.g. port 8000) and try again.'
          setError(msg)
          setLoading(false)
          return
        }
        if (response.status === 422) {
          setError(detailMsg || 'Invalid request format. Please check chart configuration and try again.')
          setLoading(false)
          return
        }
        if (response.status === 500 && detailMsg?.includes('query.args')) {
          setError('Chart generation failed due to incomplete simulation data. Some chart types may be unavailable.')
          setLoading(false)
          return
        }

        throw new Error(detailMsg || detail || `Failed to generate charts: ${response.status}`)
      }

      const data = await response.json()
      setCharts(data.charts || {})
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate charts'
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const downloadChart = async (chartName: string, chart: MonteCarloChart) => {
    try {
      // Convert base64 to blob and download
      const base64Data = chart.base64_image.split(',')[1]
      if (!base64Data) {
        throw new Error('Invalid base64 image data')
      }
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: `image/${config.format}` })
      
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${chartName}_${simulationId}.${config.format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
    } catch (err) {
      console.error('Download failed:', err)
      setError('Failed to download chart')
    }
  }

  useEffect(() => {
    if (simulationId) {
      generateCharts()
    }
  }, [simulationId, config.outcome_type])

  const chartTypeLabels = {
    distribution: 'Probability Distribution',
    tornado: 'Risk Contribution (Tornado)',
    cdf: 'Cumulative Distribution'
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-4 sm:space-y-0">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Monte Carlo Risk Analysis</h3>
          <p className="text-sm text-gray-600 mt-1">
            Statistical visualization of simulation results
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Outcome:</label>
            <select
              value={config.outcome_type}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                outcome_type: e.target.value as 'cost' | 'schedule' 
              }))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cost">Cost Analysis</option>
              <option value="schedule">Schedule Analysis</option>
            </select>
          </div>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
          
          <button
            onClick={generateCharts}
            disabled={loading}
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Chart Configuration</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chart Types</label>
              <div className="space-y-2">
                {Object.entries(chartTypeLabels).map(([type, label]) => (
                  <label key={type} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.chart_types.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfig(prev => ({
                            ...prev,
                            chart_types: [...prev.chart_types, type]
                          }))
                        } else {
                          setConfig(prev => ({
                            ...prev,
                            chart_types: prev.chart_types.filter(t => t !== type)
                          }))
                        }
                      }}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
              <select
                value={config.format}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  format: e.target.value as any 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="png">PNG (Web)</option>
                <option value="pdf">PDF (Print)</option>
                <option value="svg">SVG (Vector)</option>
                <option value="html">HTML (Interactive)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
              <select
                value={config.theme}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  theme: e.target.value as any 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="professional">Professional</option>
                <option value="presentation">Presentation</option>
                <option value="default">Default</option>
                <option value="colorblind_friendly">Colorblind Friendly</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.include_risk_heat_map}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    include_risk_heat_map: e.target.checked
                  }))}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Include Risk Heat Map</span>
              </label>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={generateCharts}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply Settings
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Charts Display */}
      {Object.keys(charts).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(charts).map(([chartName, chart]) => {
            // Check if this is an error entry
            const isError = chartName.includes('_error') || (typeof chart === 'string')

            return (
              <div key={chartName} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {isError ? `Chart Generation Issue` : chart.title}
                      </h4>
                      {chart.subtitle && !isError && (
                        <p className="text-sm text-gray-600 mt-1">{chart.subtitle}</p>
                      )}
                    </div>
                    {!isError && (
                      <button
                        onClick={() => downloadChart(chartName, chart)}
                        className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        disabled={!chart.base64_image}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {isError ? (
                    <div className="flex items-center justify-center h-64 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                        <h5 className="text-lg font-medium text-yellow-800 mb-2">Chart Unavailable</h5>
                        <p className="text-sm text-yellow-700">
                          {typeof chart === 'string' ? chart : 'This chart type is temporarily unavailable for the current simulation data.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center">
                        <ImageWithStabilizedLayout
                          src={chart.base64_image}
                          alt={chart.title}
                          className="max-w-full rounded-lg shadow-sm"
                          aspectRatio="16/9"
                          fallbackHeight={300}
                          fallbackWidth={500}
                        />
                      </div>

                      {/* Chart Metadata */}
                      {chart.metadata && Object.keys(chart.metadata).length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Chart Statistics</h5>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            {Object.entries(chart.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                                <span className="font-medium">
                                  {typeof value === 'number' ? value.toLocaleString() : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && Object.keys(charts).length === 0 && !error && (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No charts generated yet</p>
          <button
            onClick={generateCharts}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Generate Charts
          </button>
        </div>
      )}
    </div>
  )
}