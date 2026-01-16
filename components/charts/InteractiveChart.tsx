'use client'

import React, { useState, useRef, useCallback, useEffect, useDeferredValue } from 'react'
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  Brush
} from 'recharts'
import { 
  Download, 
  Filter, 
  Search, 
  MoreVertical, 
  Eye, 
  TrendingUp,
  Play,
  Pause,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react'
import { getWebSocketService, WebSocketMessage, ChartDataPoint } from '../../lib/services/websocket-service'
import { useDebounce } from '../../hooks/useDebounce'

interface ChartData {
  [key: string]: any
}

interface DrillDownLevel {
  key: string
  label: string
  data: ChartData[]
}

interface InteractiveChartProps {
  type: 'bar' | 'pie' | 'line'
  data: ChartData[]
  title?: string
  dataKey: string
  nameKey?: string
  colors?: string[]
  height?: number
  enableDrillDown?: boolean
  drillDownLevels?: DrillDownLevel[]
  enableFiltering?: boolean
  enableExport?: boolean
  enableBrushing?: boolean
  showLegend?: boolean
  className?: string
  // Real-time features
  enableRealTime?: boolean
  websocketUrl?: string
  chartId?: string
  maxDataPoints?: number
  updateInterval?: number
  animationDuration?: number
}

interface FilterState {
  searchTerm: string
  visibleSeries: string[]
  valueRange: [number, number]
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({
  type,
  data: initialData,
  title,
  dataKey,
  nameKey = 'name',
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
  height = 400,
  enableDrillDown = false,
  drillDownLevels = [],
  enableFiltering = false,
  enableBrushing = false,
  showLegend = true,
  className = '',
  // Real-time features
  enableRealTime = false,
  websocketUrl,
  chartId,
  maxDataPoints = 100,
  updateInterval = 1000,
  animationDuration = 300
}) => {
  const [data, setData] = useState(initialData)
  const [currentLevel, setCurrentLevel] = useState(0)
  const [breadcrumb, setBreadcrumb] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null)
  
  // Real-time states
  const [isRealTimeActive, setIsRealTimeActive] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionLatency, setConnectionLatency] = useState(0)
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    renderTime: 0,
    dataPoints: 0,
    droppedFrames: 0
  })
  
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    visibleSeries: [dataKey],
    valueRange: [0, 100]
  })

  const chartRef = useRef<HTMLDivElement>(null)
  const wsService = useRef(getWebSocketService({ url: websocketUrl || '' }))
  const frameCount = useRef<number>(0)
  const performanceInterval = useRef<NodeJS.Timeout | null>(null)

  // Debounce search term to reduce update frequency (300ms delay)
  const debouncedSearchTerm = useDebounce(filters.searchTerm, 300)
  
  // Defer value range filter for non-critical chart updates
  const deferredValueRange = useDeferredValue(filters.valueRange)

  // Filter data based on current filters
  const filteredData = React.useMemo(() => {
    let filtered = [...data]

    // Search filter (using debounced value)
    if (debouncedSearchTerm) {
      filtered = filtered.filter(item => 
        item[nameKey]?.toString().toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    }

    // Value range filter (using deferred value for non-critical updates)
    if (type !== 'pie') {
      const values = filtered.map(item => item[dataKey]).filter(v => typeof v === 'number')
      const minValue = Math.min(...values)
      const maxValue = Math.max(...values)
      
      filtered = filtered.filter(item => {
        const value = item[dataKey]
        if (typeof value !== 'number') return true
        const normalizedValue = ((value - minValue) / (maxValue - minValue)) * 100
        return normalizedValue >= deferredValueRange[0] && normalizedValue <= deferredValueRange[1]
      })
    }

    return filtered
  }, [data, debouncedSearchTerm, deferredValueRange, dataKey, nameKey, type])

  // Real-time data management
  const addRealTimeDataPoint = useCallback((newDataPoint: ChartDataPoint) => {
    const startTime = performance.now()
    
    setData(prevData => {
      const updatedData = [...prevData]
      
      // Convert WebSocket data point to chart format
      const chartPoint = {
        [nameKey]: new Date(newDataPoint.timestamp).toLocaleTimeString(),
        [dataKey]: newDataPoint.value,
        timestamp: newDataPoint.timestamp,
        ...newDataPoint.metadata
      }
      
      updatedData.push(chartPoint)
      
      // Limit data points for performance
      if (updatedData.length > maxDataPoints) {
        updatedData.splice(0, updatedData.length - maxDataPoints)
      }
      
      return updatedData
    })
    
    // Update performance metrics
    const renderTime = performance.now() - startTime
    setPerformanceMetrics(prev => ({
      ...prev,
      renderTime,
      dataPoints: data.length
    }))
    frameCount.current++
  }, [nameKey, dataKey, maxDataPoints, data.length])

  // WebSocket connection management
  useEffect(() => {
    if (!enableRealTime || !websocketUrl || !chartId) return

    const handleConnectionStatus = (status: any) => {
      setIsConnected(status.connected)
      setConnectionLatency(status.latency)
    }

    const handleDataMessage = (message: WebSocketMessage) => {
      if (message.type === 'data' && message.payload.chartId === chartId) {
        const dataPoint: ChartDataPoint = message.payload.data
        addRealTimeDataPoint(dataPoint)
      }
    }

    // Subscribe to WebSocket events
    const unsubscribeStatus = wsService.current.onStatusChange(handleConnectionStatus)
    const unsubscribeData = wsService.current.on('data', handleDataMessage)

    return () => {
      unsubscribeStatus()
      unsubscribeData()
    }
  }, [enableRealTime, websocketUrl, chartId, addRealTimeDataPoint])

  // Performance monitoring
  useEffect(() => {
    if (!enableRealTime) return

    performanceInterval.current = setInterval(() => {
      setPerformanceMetrics(prev => ({
        ...prev,
        fps: frameCount.current
      }))
      frameCount.current = 0
    }, 1000)

    return () => {
      if (performanceInterval.current) {
        clearInterval(performanceInterval.current)
      }
    }
  }, [enableRealTime])

  // Start/stop real-time updates
  const toggleRealTime = useCallback(async () => {
    if (!enableRealTime || !chartId) return

    if (isRealTimeActive) {
      // Stop real-time updates
      wsService.current.unsubscribeFromChart(chartId)
      wsService.current.disconnect()
      setIsRealTimeActive(false)
    } else {
      // Start real-time updates
      try {
        await wsService.current.connect()
        wsService.current.subscribeToChart(chartId, {
          interval: updateInterval,
          maxPoints: maxDataPoints
        })
        setIsRealTimeActive(true)
      } catch (error) {
        console.error('Failed to start real-time updates:', error)
      }
    }
  }, [enableRealTime, chartId, isRealTimeActive, updateInterval, maxDataPoints])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enableRealTime && isRealTimeActive) {
        wsService.current.disconnect()
      }
      if (performanceInterval.current) {
        clearInterval(performanceInterval.current)
      }
    }
  }, [enableRealTime, isRealTimeActive])

  // Handle drill down
  const handleDrillDown = useCallback((dataPoint: any) => {
    if (!enableDrillDown || currentLevel >= drillDownLevels.length) return

    const nextLevel = drillDownLevels[currentLevel]
    if (nextLevel && dataPoint[nextLevel.key]) {
      setData(nextLevel.data.filter(item => item.parentId === dataPoint.id))
      setCurrentLevel(prev => prev + 1)
      setBreadcrumb(prev => [...prev, dataPoint[nameKey]])
    }
  }, [enableDrillDown, currentLevel, drillDownLevels, nameKey])

  // Handle drill up
  const handleDrillUp = useCallback((level: number) => {
    if (level === 0) {
      setData(initialData)
      setCurrentLevel(0)
      setBreadcrumb([])
    } else {
      // Navigate to specific level
      const targetLevel = drillDownLevels[level - 1]
      if (targetLevel) {
        setData(targetLevel.data)
        setCurrentLevel(level)
        setBreadcrumb(prev => prev.slice(0, level))
      }
    }
  }, [initialData, drillDownLevels])

  // Handle context menu
  const handleContextMenu = useCallback((event: React.MouseEvent, dataPoint?: any) => {
    event.preventDefault()
    setContextMenuPosition({ x: event.clientX, y: event.clientY })
    setSelectedDataPoint(dataPoint)
    setShowContextMenu(true)
  }, [])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setShowContextMenu(false)
    setSelectedDataPoint(null)
  }, [])

  // Convert data to CSV
  const convertToCSV = (data: ChartData[]) => {
    if (data.length === 0 || !data[0]) return ''
    
    const headers = Object.keys(data[0])
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      }).join(','))
    ]
    
    return csvRows.join('\n')
  }

  // Download blob as file
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Custom tooltip with drill-down info and advanced features
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-gray-900">{`${nameKey}: ${label}`}</p>
            {enableRealTime && data.timestamp && (
              <span className="text-xs text-gray-500">
                {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          
          {payload.map((entry: any, index: number) => (
            <div key={index} className="mb-2">
              <p style={{ color: entry.color }} className="font-medium mb-1">
                {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}`}
              </p>
              
              {/* Trend indicator for real-time data */}
              {enableRealTime && isRealTimeActive && index === 0 && data.previousValue && (
                <div className="flex items-center text-xs">
                  {data.value > data.previousValue ? (
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  ) : (
                    <TrendingUp className="h-3 w-3 text-red-500 mr-1 transform rotate-180" />
                  )}
                  <span className={data.value > data.previousValue ? 'text-green-600' : 'text-red-600'}>
                    {((data.value - data.previousValue) / data.previousValue * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          ))}
          
          {/* Additional data fields */}
          <div className="space-y-1">
            {Object.entries(data).map(([key, value]) => {
              if (key !== nameKey && key !== dataKey && key !== 'timestamp' && key !== 'previousValue' && typeof value !== 'object') {
                return (
                  <p key={key} className="text-sm text-gray-600">
                    {`${key}: ${value}`}
                  </p>
                )
              }
              return null
            })}
          </div>
          
          {/* Interactive Actions */}
          <div className="mt-3 pt-2 border-t border-gray-200 space-y-1">
            {enableDrillDown && currentLevel < drillDownLevels.length && (
              <button
                onClick={() => handleDrillDown(data)}
                className="w-full text-left text-xs text-blue-600 hover:text-blue-800 flex items-center"
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                Click to drill down
              </button>
            )}
            
            <button
              onClick={() => handleDataPointAction(data, 'details')}
              className="w-full text-left text-xs text-gray-600 hover:text-gray-800 flex items-center"
            >
              <Eye className="h-3 w-3 mr-1" />
              View details
            </button>
            
            <button
              onClick={() => handleDataPointAction(data, 'filter')}
              className="w-full text-left text-xs text-gray-600 hover:text-gray-800 flex items-center"
            >
              <Filter className="h-3 w-3 mr-1" />
              Filter by this value
            </button>
          </div>
        </div>
      )
    }
    return null
  }

  // Handle chart click for drill down
  const handleChartClick = (data: any) => {
    if (enableDrillDown) {
      handleDrillDown(data)
    }
  }

  // Handle data point actions from tooltip
  const handleDataPointAction = useCallback((dataPoint: any, action: 'details' | 'filter' | 'export') => {
    switch (action) {
      case 'details':
        // Show detailed modal or expand tooltip
        setSelectedDataPoint(dataPoint)
        // Could trigger a modal or detailed view
        console.log('Show details for:', dataPoint)
        break
        
      case 'filter':
        // Apply filter based on this data point
        const filterValue = dataPoint[dataKey]
        if (typeof filterValue === 'number') {
          const tolerance = 0.1 // 10% tolerance
          const minValue = filterValue * (1 - tolerance)
          const maxValue = filterValue * (1 + tolerance)
          
          // Convert to percentage range
          const allValues = data.map(item => item[dataKey]).filter(v => typeof v === 'number')
          const dataMin = Math.min(...allValues)
          const dataMax = Math.max(...allValues)
          
          const minPercent = ((minValue - dataMin) / (dataMax - dataMin)) * 100
          const maxPercent = ((maxValue - dataMin) / (dataMax - dataMin)) * 100
          
          setFilters(prev => ({
            ...prev,
            valueRange: [Math.max(0, minPercent), Math.min(100, maxPercent)]
          }))
          setShowFilters(true)
        }
        break
        
      case 'export':
        // Export single data point
        const exportData = {
          dataPoint,
          timestamp: new Date().toISOString(),
          chartTitle: title,
          chartType: type
        }
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        downloadBlob(blob, `${title || 'chart'}-datapoint-${Date.now()}.json`)
        break
    }
  }, [dataKey, data, title, type])

  // Enhanced export functionality with high-quality output
  const exportData = useCallback((format: 'json' | 'csv' | 'image' | 'pdf') => {
    const exportData = {
      title,
      type,
      data: filteredData,
      timestamp: new Date().toISOString(),
      level: currentLevel,
      breadcrumb,
      filters: filters,
      realTimeStatus: enableRealTime ? {
        active: isRealTimeActive,
        connected: isConnected,
        latency: connectionLatency
      } : null,
      performanceMetrics: enableRealTime ? performanceMetrics : null
    }

    switch (format) {
      case 'json':
        const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
        downloadBlob(jsonBlob, `${title || 'chart'}-data.json`)
        break

      case 'csv':
        const csvContent = convertToCSV(filteredData)
        const csvBlob = new Blob([csvContent], { type: 'text/csv' })
        downloadBlob(csvBlob, `${title || 'chart'}-data.csv`)
        break

      case 'image':
        exportAsImage('png')
        break
        
      case 'pdf':
        exportAsImage('pdf')
        break
    }
    closeContextMenu()
  }, [filteredData, title, type, currentLevel, breadcrumb, filters, enableRealTime, isRealTimeActive, isConnected, connectionLatency, performanceMetrics])

  // Enhanced image export with multiple formats
  const exportAsImage = async (format: 'png' | 'svg' | 'pdf' = 'png') => {
    if (!chartRef.current) return

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // High resolution for better quality
      const scale = 2
      canvas.width = chartRef.current.offsetWidth * scale
      canvas.height = chartRef.current.offsetHeight * scale
      ctx.scale(scale, scale)

      const svgElement = chartRef.current.querySelector('svg')
      if (!svgElement) return

      // Clone SVG to avoid modifying original
      const svgClone = svgElement.cloneNode(true) as SVGElement
      
      // Enhance SVG for export
      svgClone.setAttribute('width', chartRef.current.offsetWidth.toString())
      svgClone.setAttribute('height', chartRef.current.offsetHeight.toString())
      
      // Add title and metadata to export
      if (title) {
        const titleElement = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        titleElement.setAttribute('x', '20')
        titleElement.setAttribute('y', '30')
        titleElement.setAttribute('font-family', 'Arial, sans-serif')
        titleElement.setAttribute('font-size', '16')
        titleElement.setAttribute('font-weight', 'bold')
        titleElement.setAttribute('fill', '#1f2937')
        titleElement.textContent = title
        svgClone.insertBefore(titleElement, svgClone.firstChild)
      }

      const svgData = new XMLSerializer().serializeToString(svgClone)
      
      if (format === 'svg') {
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        downloadBlob(svgBlob, `${title || 'chart'}.svg`)
        return
      }

      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        // White background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale)
        
        // Draw image
        ctx.drawImage(img, 0, 0)

        if (format === 'png') {
          canvas.toBlob((blob) => {
            if (blob) {
              downloadBlob(blob, `${title || 'chart'}.png`)
            }
          }, 'image/png', 1.0)
        } else if (format === 'pdf') {
          // For PDF, we'd need a PDF library like jsPDF
          // For now, export as high-quality PNG
          canvas.toBlob((blob) => {
            if (blob) {
              downloadBlob(blob, `${title || 'chart'}-hq.png`)
            }
          }, 'image/png', 1.0)
        }

        URL.revokeObjectURL(svgUrl)
      }
      img.src = svgUrl
    } catch (error) {
      console.error('Failed to export chart as image:', error)
    }
  }

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: filteredData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    }

    const animationProps = enableRealTime && isRealTimeActive ? {
      isAnimationActive: true,
      animationDuration: animationDuration,
      animationEasing: 'ease-out' as const
    } : {
      isAnimationActive: false
    }

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={nameKey} 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Bar 
              dataKey={dataKey} 
              fill={colors[0]}
              radius={[4, 4, 0, 0]}
              onClick={handleChartClick}
              style={{ cursor: enableDrillDown ? 'pointer' : 'default' }}
              {...animationProps}
            />
            {enableBrushing && <Brush dataKey={nameKey} height={30} stroke={colors[0]} />}
          </BarChart>
        )

      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Pie
              data={filteredData}
              cx="50%"
              cy="50%"
              outerRadius={Math.min(height * 0.35, 120)}
              fill="#8884d8"
              dataKey={dataKey}
              onClick={handleChartClick}
              style={{ cursor: enableDrillDown ? 'pointer' : 'default' }}
              label={({ name, percent }) => 
                `${name}: ${((percent || 0) * 100).toFixed(1)}%`
              }
              {...animationProps}
            >
              {filteredData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || colors[index % colors.length]} 
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
          </PieChart>
        )

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={nameKey} 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={colors[0] || '#3B82F6'}
              strokeWidth={2}
              dot={enableRealTime && isRealTimeActive ? false : { r: 4, cursor: enableDrillDown ? 'pointer' : 'default' }}
              activeDot={{ r: 6 }}
              onClick={handleChartClick}
              {...animationProps}
            />
            {enableBrushing && <Brush dataKey={nameKey} height={30} stroke={colors[0] || '#3B82F6'} />}
          </LineChart>
        )

      default:
        return null
    }
  }

  return (
    <div className={`relative bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex-1">
          {title && (
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {enableRealTime && (
                <div className={`flex items-center text-sm px-2 py-1 rounded-full ${
                  isRealTimeActive 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <Zap className="h-3 w-3 mr-1" />
                  {isRealTimeActive ? 'Live' : 'Static'}
                </div>
              )}
            </div>
          )}
          
          {/* Connection Status */}
          {enableRealTime && (
            <div className={`flex items-center text-xs space-x-3 ${
              isConnected ? 'text-green-600' : 'text-red-600'
            }`}>
              {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              {isConnected && connectionLatency > 0 && (
                <span className="text-gray-500">
                  {connectionLatency}ms
                </span>
              )}
            </div>
          )}
          
          {/* Breadcrumb */}
          {breadcrumb.length > 0 && (
            <nav className="flex items-center space-x-2 text-sm text-gray-600 mt-2">
              <button
                onClick={() => handleDrillUp(0)}
                className="hover:text-blue-600 transition-colors"
              >
                Home
              </button>
              {breadcrumb.map((crumb, index) => (
                <React.Fragment key={index}>
                  <span>/</span>
                  <button
                    onClick={() => handleDrillUp(index + 1)}
                    className="hover:text-blue-600 transition-colors"
                  >
                    {crumb}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Performance Metrics */}
          {enableRealTime && isRealTimeActive && (
            <div className="hidden sm:flex items-center text-xs text-gray-500 space-x-2 mr-2">
              <span>FPS: {performanceMetrics.fps}</span>
              <span>Points: {performanceMetrics.dataPoints}</span>
              <span>Render: {performanceMetrics.renderTime.toFixed(1)}ms</span>
            </div>
          )}
          
          {/* Real-time Controls */}
          {enableRealTime && (
            <button
              onClick={toggleRealTime}
              className={`p-2 rounded-lg transition-colors ${
                isRealTimeActive 
                  ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                  : 'bg-green-100 text-green-600 hover:bg-green-200'
              }`}
              title={isRealTimeActive ? 'Stop Real-time Updates' : 'Start Real-time Updates'}
            >
              {isRealTimeActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
          )}
          
          {enableFiltering && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Toggle Filters"
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
          
          <button
            onClick={(e) => handleContextMenu(e)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="More Options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && enableFiltering && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  placeholder="Search items..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            
            {type !== 'pie' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Value Range (%)</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={filters.valueRange[0]}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      valueRange: [parseInt(e.target.value), prev.valueRange[1]] 
                    }))}
                    min="0"
                    max="100"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                  <input
                    type="number"
                    value={filters.valueRange[1]}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      valueRange: [prev.valueRange[0], parseInt(e.target.value)] 
                    }))}
                    min="0"
                    max="100"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>
            )}
            
            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  searchTerm: '',
                  visibleSeries: [dataKey],
                  valueRange: [0, 100]
                })}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div 
        ref={chartRef}
        className="p-4"
        onContextMenu={handleContextMenu}
      >
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex justify-between items-center">
          <span>
            Showing {filteredData.length} of {data.length} items
            {enableRealTime && isRealTimeActive && (
              <span className="ml-2 text-green-600">• Live Updates Active</span>
            )}
          </span>
          <div className="flex items-center space-x-4">
            <span>
              Level {currentLevel + 1} of {drillDownLevels.length + 1}
            </span>
            {enableRealTime && data.length > 0 && (
              <span>
                Latest: {new Date(data[data.length - 1]?.timestamp || Date.now()).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={closeContextMenu}
          />
          <div 
            className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48"
            style={{ 
              left: contextMenuPosition.x, 
              top: contextMenuPosition.y,
              transform: 'translate(-50%, -10px)'
            }}
          >
            {/* Export Options */}
            <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Export
            </div>
            <button
              onClick={() => exportData('json')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as JSON
            </button>
            <button
              onClick={() => exportData('csv')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </button>
            <button
              onClick={() => exportData('image')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as PNG
            </button>
            <button
              onClick={() => exportAsImage('svg')}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as SVG
            </button>
            
            <hr className="my-2" />
            
            {/* Chart Actions */}
            <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Actions
            </div>
            <button
              onClick={() => {
                setData(initialData)
                setCurrentLevel(0)
                setBreadcrumb([])
                setFilters({
                  searchTerm: '',
                  visibleSeries: [dataKey],
                  valueRange: [0, 100]
                })
                closeContextMenu()
              }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
            >
              <Eye className="h-4 w-4 mr-2" />
              Reset View
            </button>
            
            {enableFiltering && (
              <button
                onClick={() => {
                  setShowFilters(!showFilters)
                  closeContextMenu()
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
            )}
            
            {enableRealTime && (
              <button
                onClick={() => {
                  toggleRealTime()
                  closeContextMenu()
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                {isRealTimeActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isRealTimeActive ? 'Stop Real-time' : 'Start Real-time'}
              </button>
            )}
            
            {selectedDataPoint && enableDrillDown && currentLevel < drillDownLevels.length && (
              <>
                <hr className="my-2" />
                <button
                  onClick={() => {
                    handleDrillDown(selectedDataPoint)
                    closeContextMenu()
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Drill Down
                </button>
              </>
            )}
            
            {/* Performance Info */}
            {enableRealTime && isRealTimeActive && (
              <>
                <hr className="my-2" />
                <div className="px-4 py-2 text-xs text-gray-500">
                  <div>FPS: {performanceMetrics.fps}</div>
                  <div>Render: {performanceMetrics.renderTime.toFixed(1)}ms</div>
                  <div>Latency: {connectionLatency}ms</div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default InteractiveChart