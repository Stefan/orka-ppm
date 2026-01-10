'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts'
import { Play, Pause, Square, Settings, Wifi, WifiOff } from 'lucide-react'

interface DataPoint {
  timestamp: number
  value: number
  label?: string
  [key: string]: any
}

interface RealTimeChartProps {
  title?: string
  dataKey: string
  maxDataPoints?: number
  updateInterval?: number
  enableWebSocket?: boolean
  websocketUrl?: string
  mockDataGenerator?: () => number
  height?: number
  color?: string
  fillArea?: boolean
  showGrid?: boolean
  animationDuration?: number
  className?: string
}

interface ChartSettings {
  updateInterval: number
  maxDataPoints: number
  animationEnabled: boolean
  smoothTransitions: boolean
}

const RealTimeChart: React.FC<RealTimeChartProps> = ({
  title,
  dataKey,
  maxDataPoints = 50,
  updateInterval = 1000,
  enableWebSocket = false,
  websocketUrl,
  mockDataGenerator,
  height = 300,
  color = '#3B82F6',
  fillArea = false,
  showGrid = true,
  animationDuration = 300,
  className = ''
}) => {
  const [data, setData] = useState<DataPoint[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<ChartSettings>({
    updateInterval,
    maxDataPoints,
    animationEnabled: true,
    smoothTransitions: true
  })
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 0,
    renderTime: 0,
    dataPoints: 0
  })

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const websocketRef = useRef<WebSocket | null>(null)
  const lastRenderTime = useRef<number>(0)
  const frameCount = useRef<number>(0)
  const fpsInterval = useRef<NodeJS.Timeout | null>(null)

  // Performance monitoring
  useEffect(() => {
    fpsInterval.current = setInterval(() => {
      setPerformanceMetrics(prev => ({
        ...prev,
        fps: frameCount.current,
        dataPoints: data.length
      }))
      frameCount.current = 0
    }, 1000)

    return () => {
      if (fpsInterval.current) clearInterval(fpsInterval.current)
    }
  }, [data.length])

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!enableWebSocket || !websocketUrl) return

    try {
      websocketRef.current = new WebSocket(websocketUrl)
      
      websocketRef.current.onopen = () => {
        setIsConnected(true)
        console.log('WebSocket connected')
      }

      websocketRef.current.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data)
          addDataPoint(newData.value || newData)
        } catch (error) {
          console.error('Failed to parse WebSocket data:', error)
        }
      }

      websocketRef.current.onclose = () => {
        setIsConnected(false)
        console.log('WebSocket disconnected')
      }

      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error)
    }
  }, [enableWebSocket, websocketUrl])

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (websocketRef.current) {
      websocketRef.current.close()
      websocketRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Add new data point with performance optimization
  const addDataPoint = useCallback((value: number) => {
    const startTime = performance.now()
    
    setData(prevData => {
      const newPoint: DataPoint = {
        timestamp: Date.now(),
        value,
        label: new Date().toLocaleTimeString()
      }

      const updatedData = [...prevData, newPoint]
      
      // Limit data points for performance
      if (updatedData.length > settings.maxDataPoints) {
        updatedData.splice(0, updatedData.length - settings.maxDataPoints)
      }

      return updatedData
    })

    const renderTime = performance.now() - startTime
    setPerformanceMetrics(prev => ({ ...prev, renderTime }))
    frameCount.current++
  }, [settings.maxDataPoints])

  // Generate mock data
  const generateMockData = useCallback(() => {
    if (mockDataGenerator) {
      return mockDataGenerator()
    }
    
    // Default mock data generator with realistic patterns
    const baseValue = 50
    const trend = Math.sin(Date.now() / 10000) * 20
    const noise = (Math.random() - 0.5) * 10
    return Math.max(0, baseValue + trend + noise)
  }, [mockDataGenerator])

  // Start real-time updates
  const startUpdates = useCallback(() => {
    if (intervalRef.current) return

    setIsPlaying(true)
    
    if (enableWebSocket) {
      connectWebSocket()
    } else {
      intervalRef.current = setInterval(() => {
        const newValue = generateMockData()
        addDataPoint(newValue)
      }, settings.updateInterval)
    }
  }, [enableWebSocket, connectWebSocket, generateMockData, addDataPoint, settings.updateInterval])

  // Stop real-time updates
  const stopUpdates = useCallback(() => {
    setIsPlaying(false)
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    if (enableWebSocket) {
      disconnectWebSocket()
    }
  }, [enableWebSocket, disconnectWebSocket])

  // Clear all data
  const clearData = () => {
    setData([])
  }

  // Update settings
  const updateSettings = (newSettings: Partial<ChartSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
    
    // Restart if playing with new interval
    if (isPlaying && newSettings.updateInterval) {
      stopUpdates()
      setTimeout(() => startUpdates(), 100)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopUpdates()
      if (fpsInterval.current) clearInterval(fpsInterval.current)
    }
  }, [stopUpdates])

  // Custom tooltip with performance info
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
          <p className="font-medium text-gray-900">
            Time: {new Date(data.timestamp).toLocaleTimeString()}
          </p>
          <p style={{ color: payload[0].color }} className="font-medium">
            {`${dataKey}: ${payload[0].value.toFixed(2)}`}
          </p>
        </div>
      )
    }
    return null
  }

  // Format X-axis labels for mobile
  const formatXAxisLabel = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className={`relative bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {enableWebSocket && (
            <div className={`flex items-center text-sm ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? <Wifi className="h-4 w-4 mr-1" /> : <WifiOff className="h-4 w-4 mr-1" />}
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Performance Metrics */}
          <div className="hidden sm:flex items-center text-xs text-gray-500 space-x-2">
            <span>FPS: {performanceMetrics.fps}</span>
            <span>Points: {performanceMetrics.dataPoints}</span>
            <span>Render: {performanceMetrics.renderTime.toFixed(1)}ms</span>
          </div>
          
          {/* Controls */}
          <button
            onClick={isPlaying ? stopUpdates : startUpdates}
            className={`p-2 rounded-lg transition-colors ${
              isPlaying 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-green-100 text-green-600 hover:bg-green-200'
            }`}
            title={isPlaying ? 'Stop' : 'Start'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          
          <button
            onClick={clearData}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Clear Data"
          >
            <Square className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Update Interval (ms)
              </label>
              <input
                type="number"
                value={settings.updateInterval}
                onChange={(e) => updateSettings({ updateInterval: parseInt(e.target.value) })}
                min="100"
                max="10000"
                step="100"
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Data Points
              </label>
              <input
                type="number"
                value={settings.maxDataPoints}
                onChange={(e) => updateSettings({ maxDataPoints: parseInt(e.target.value) })}
                min="10"
                max="1000"
                step="10"
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.animationEnabled}
                  onChange={(e) => updateSettings({ animationEnabled: e.target.checked })}
                  className="mr-2"
                />
                Enable Animations
              </label>
            </div>
            
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={settings.smoothTransitions}
                  onChange={(e) => updateSettings({ smoothTransitions: e.target.checked })}
                  className="mr-2"
                />
                Smooth Transitions
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="p-4">
        <ResponsiveContainer width="100%" height={height}>
          {fillArea ? (
            <AreaChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey="timestamp"
                tickFormatter={formatXAxisLabel}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fill={color}
                fillOpacity={0.3}
                strokeWidth={2}
                dot={false}
                isAnimationActive={settings.animationEnabled}
                animationDuration={settings.smoothTransitions ? animationDuration : 0}
              />
            </AreaChart>
          ) : (
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey="timestamp"
                tickFormatter={formatXAxisLabel}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={settings.animationEnabled}
                animationDuration={settings.smoothTransitions ? animationDuration : 0}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex justify-between items-center">
          <span>
            {data.length > 0 
              ? `Latest: ${data[data.length - 1]?.value.toFixed(2)} at ${new Date(data[data.length - 1]?.timestamp).toLocaleTimeString()}`
              : 'No data'
            }
          </span>
          <span>
            {isPlaying ? 'Live' : 'Paused'} • {data.length}/{settings.maxDataPoints} points
          </span>
        </div>
      </div>
    </div>
  )
}

export default RealTimeChart