'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslations } from '@/lib/i18n/context'
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
  Legend
} from 'recharts'
import { 
  Download, 
  Maximize2, 
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react'

interface ChartData {
  [key: string]: any
}

interface MobileOptimizedChartProps {
  type: 'bar' | 'pie' | 'line'
  data: ChartData[]
  title?: string
  dataKey: string
  nameKey?: string
  colors?: string[]
  height?: number
  enablePinchZoom?: boolean
  enablePan?: boolean
  enableExport?: boolean
  showLegend?: boolean
  className?: string
  onDataPointClick?: (data: any) => void
}

interface TouchState {
  startDistance: number
  startScale: number
  startPan: { x: number; y: number }
  isPinching: boolean
  isPanning: boolean
  lastTouchTime: number
}

interface ViewState {
  scale: number
  panX: number
  panY: number
  isFullscreen: boolean
}

const MobileOptimizedChart: React.FC<MobileOptimizedChartProps> = ({
  type,
  data,
  title,
  dataKey,
  nameKey = 'name',
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'],
  height = 300,
  enablePinchZoom = true,
  enablePan = true,
  enableExport = true,
  showLegend = true,
  className = '',
  onDataPointClick
}) => {
  const { t } = useTranslations()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const [touchState, setTouchState] = useState<TouchState>({
    startDistance: 0,
    startScale: 1,
    startPan: { x: 0, y: 0 },
    isPinching: false,
    isPanning: false,
    lastTouchTime: 0
  })
  
  const [viewState, setViewState] = useState<ViewState>({
    scale: 1,
    panX: 0,
    panY: 0,
    isFullscreen: false
  })

  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [isMounted, setIsMounted] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Detect orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      const isLandscape = window.innerWidth > window.innerHeight
      setOrientation(isLandscape ? 'landscape' : 'portrait')
      
      // Reset view state on orientation change to prevent layout issues
      setViewState(prev => ({
        ...prev,
        scale: 1,
        panX: 0,
        panY: 0
      }))
    }

    handleOrientationChange() // Initial check
    window.addEventListener('resize', handleOrientationChange)
    window.addEventListener('orientationchange', handleOrientationChange)

    return () => {
      window.removeEventListener('resize', handleOrientationChange)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0
    const touch1 = touches[0]
    const touch2 = touches[1]
    if (!touch1 || !touch2) return 0
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    )
  }

  // Get center point of two touches
  const getTouchCenter = (touches: React.TouchList): { x: number; y: number } => {
    if (touches.length < 2) return { x: 0, y: 0 }
    const touch1 = touches[0]
    const touch2 = touches[1]
    if (!touch1 || !touch2) return { x: 0, y: 0 }
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    }
  }

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touches = e.touches
    const currentTime = Date.now()

    if (touches.length === 2 && enablePinchZoom) {
      // Pinch zoom start
      const distance = getTouchDistance(touches)
      const center = getTouchCenter(touches)
      
      setTouchState(prev => ({
        ...prev,
        startDistance: distance,
        startScale: viewState.scale,
        startPan: { x: center.x, y: center.y },
        isPinching: true,
        isPanning: false,
        lastTouchTime: currentTime
      }))
    } else if (touches.length === 1 && enablePan) {
      // Pan start
      const touch = touches[0]
      if (!touch) return
      
      setTouchState(prev => ({
        ...prev,
        startPan: { x: touch.clientX, y: touch.clientY },
        isPinching: false,
        isPanning: true,
        lastTouchTime: currentTime
      }))
    }
  }, [enablePinchZoom, enablePan, viewState.scale])

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touches = e.touches

    if (touches.length === 2 && touchState.isPinching && enablePinchZoom) {
      // Pinch zoom
      const distance = getTouchDistance(touches)
      const scaleChange = distance / touchState.startDistance
      const newScale = Math.max(0.5, Math.min(3, touchState.startScale * scaleChange))
      
      setViewState(prev => ({
        ...prev,
        scale: newScale
      }))
    } else if (touches.length === 1 && touchState.isPanning && enablePan && viewState.scale > 1) {
      // Pan (only when zoomed in)
      const touch = touches[0]
      if (!touch) return
      const deltaX = touch.clientX - touchState.startPan.x
      const deltaY = touch.clientY - touchState.startPan.y
      
      setViewState(prev => ({
        ...prev,
        panX: prev.panX + deltaX * 0.5,
        panY: prev.panY + deltaY * 0.5
      }))
      
      setTouchState(prev => ({
        ...prev,
        startPan: { x: touch.clientX, y: touch.clientY }
      }))
    }
  }, [touchState, enablePinchZoom, enablePan, viewState.scale])

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    const currentTime = Date.now()
    const timeDiff = currentTime - touchState.lastTouchTime

    // Handle tap (quick touch)
    if (timeDiff < 300 && !touchState.isPinching && !touchState.isPanning) {
      // Double tap to reset zoom
      if (timeDiff < 300 && viewState.scale !== 1) {
        setViewState(prev => ({
          ...prev,
          scale: 1,
          panX: 0,
          panY: 0
        }))
      }
    }

    setTouchState(prev => ({
      ...prev,
      isPinching: false,
      isPanning: false
    }))
  }, [touchState, viewState.scale])

  // Reset view
  const resetView = useCallback(() => {
    setViewState({
      scale: 1,
      panX: 0,
      panY: 0,
      isFullscreen: false
    })
  }, [])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setViewState(prev => ({
      ...prev,
      isFullscreen: !prev.isFullscreen
    }))
  }, [])

  // Zoom in/out programmatically
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    setViewState(prev => ({
      ...prev,
      scale: direction === 'in' 
        ? Math.min(3, prev.scale * 1.2)
        : Math.max(0.5, prev.scale / 1.2)
    }))
  }, [])

  // Export chart
  const exportChart = useCallback(async () => {
    if (!chartRef.current) return

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const rect = chartRef.current.getBoundingClientRect()
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2

      const svgElement = chartRef.current.querySelector('svg')
      if (!svgElement) return

      const svgData = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new Image()
      img.onload = () => {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${title || 'chart'}-${Date.now()}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }
        }, 'image/png')

        URL.revokeObjectURL(svgUrl)
      }
      img.src = svgUrl
    } catch (error) {
      console.error('Failed to export chart:', error)
    }
  }, [title])

  // Custom tooltip optimized for mobile
  const MobileTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 max-w-xs text-sm">
          <p className="font-medium text-gray-900 dark:text-slate-100 mb-1">{`${nameKey}: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {`${entry.name}: ${typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Handle chart click with touch optimization
  const handleChartClick = useCallback((data: any) => {
    // Prevent click if user was pinching or panning
    if (touchState.isPinching || touchState.isPanning) return
    
    if (onDataPointClick) {
      onDataPointClick(data)
    }
  }, [touchState, onDataPointClick])

  // Render chart based on type with mobile optimizations
  const renderChart = () => {
    if (!isMounted) return null // Prevent SSR issues
    
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024
    const isMobile = width < 768
    const isTabletOrSmaller = width < 1024 // iPad Air ~820px: compact layout, no overflowing legend
    const chartHeight = viewState.isFullscreen 
      ? (typeof window !== 'undefined' ? Math.max(window.innerHeight - 120, 200) : height)
      : orientation === 'landscape' && isMobile 
        ? Math.min(height, typeof window !== 'undefined' ? Math.max(window.innerHeight * 0.6, 200) : height)
        : Math.max(height, 200) // Ensure minimum height of 200px

    const commonProps = {
      data,
      margin: isMobile 
        ? { top: 10, right: 10, left: 10, bottom: 10 }
        : isTabletOrSmaller
          ? { top: 10, right: 15, left: 15, bottom: 10 }
          : { top: 20, right: 30, left: 20, bottom: 20 }
    }

    const tickProps = {
      fontSize: isMobile ? 10 : 12,
      angle: isMobile ? -45 : 0,
      textAnchor: (isMobile ? 'end' : 'middle') as 'end' | 'middle' | 'start'
    }

    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={nameKey} 
              tick={tickProps}
              height={isMobile ? 50 : 60}
              interval={isMobile ? 'preserveStartEnd' : 0}
            />
            <YAxis 
              tick={{ fontSize: isMobile ? 10 : 12 }}
              width={isMobile ? 40 : 60}
            />
            <Tooltip content={<MobileTooltip />} />
            {showLegend && !isMobile && <Legend />}
            <Bar 
              dataKey={dataKey} 
              fill={colors[0]}
              radius={[2, 2, 0, 0]}
              onClick={handleChartClick}
              style={{ cursor: 'pointer' }}
            />
          </BarChart>
        )

      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={Math.min(chartHeight * 0.3, isMobile ? 80 : isTabletOrSmaller ? 95 : 120)}
              fill="#8884d8"
              dataKey={dataKey}
              onClick={handleChartClick}
              style={{ cursor: 'pointer' }}
              label={isTabletOrSmaller ? false : ({ name, percent }) =>
                `${name}: ${((percent || 0) * 100).toFixed(1)}%`
              }
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || colors[index % colors.length]} 
                />
              ))}
            </Pie>
            <Tooltip content={<MobileTooltip />} />
            {showLegend && !isTabletOrSmaller && <Legend />}
          </PieChart>
        )

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={nameKey} 
              tick={tickProps}
              height={isMobile ? 50 : 60}
              interval={isMobile ? 'preserveStartEnd' : 0}
            />
            <YAxis 
              tick={{ fontSize: isMobile ? 10 : 12 }}
              width={isMobile ? 40 : 60}
            />
            <Tooltip content={<MobileTooltip />} />
            {showLegend && !isMobile && <Legend />}
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={colors[0] || '#3B82F6'}
              strokeWidth={isMobile ? 2 : 3}
              dot={{ r: isMobile ? 3 : 4, cursor: 'pointer' }}
              activeDot={{ r: isMobile ? 5 : 6 }}
              onClick={handleChartClick}
            />
          </LineChart>
        )

      default:
        return null
    }
  }

  const containerClasses = `
    relative bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden
    ${viewState.isFullscreen ? 'fixed inset-0 z-50' : ''}
    ${className}
  `

  const chartTransform = `
    scale(${viewState.scale}) 
    translate(${viewState.panX}px, ${viewState.panY}px)
  `

  // Show loading state during SSR or before mount
  if (!isMounted) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          {title && (
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">
              {title}
            </h3>
          )}
        </div>
        <div 
          className="relative overflow-hidden flex items-center justify-center"
          style={{ 
            height: Math.max(height, 200),
            minHeight: '200px'
          }}
        >
          <div className="text-gray-500 dark:text-slate-400 text-sm">{t('charts.loadingChart')}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">
              {title}
            </h3>
          )}
          {orientation === 'landscape' && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {t('charts.landscapeMode')}
            </p>
          )}
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          {enablePinchZoom && (
            <>
              <button
                onClick={() => handleZoom('out')}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg transition-colors"
                title="Zoom Out"
                disabled={viewState.scale <= 0.5}
              >
                <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
              <button
                onClick={() => handleZoom('in')}
                className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg transition-colors"
                title="Zoom In"
                disabled={viewState.scale >= 3}
              >
                <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
              </button>
            </>
          )}
          
          <button
            onClick={resetView}
            className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg transition-colors"
            title="Reset View"
          >
            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg transition-colors"
            title={viewState.isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {viewState.isFullscreen ? (
              <Minimize2 className="h-3 w-3 sm:h-4 sm:w-4" />
            ) : (
              <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4" />
            )}
          </button>
          
          {enableExport && (
            <button
              onClick={exportChart}
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 rounded-lg transition-colors"
              title="Export Chart"
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div 
        ref={chartContainerRef}
        className="relative overflow-hidden"
        style={{ 
          height: viewState.isFullscreen 
            ? 'calc(100vh - 80px)' 
            : Math.max(height, 200),
          minHeight: '200px',
          width: '100%',
          minWidth: 0,
          touchAction: 'none'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={chartRef}
          className="w-full min-w-0 transition-transform duration-200 ease-out"
          style={{
            height: '300px',
            transform: chartTransform,
            transformOrigin: 'center center'
          }}
        >
          {isMounted ? (
            <ResponsiveContainer
              width="100%"
              height={300}
              minWidth={0}
              debounce={50}
            >
              {renderChart()}
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full bg-gray-100 dark:bg-slate-700 animate-pulse rounded flex items-center justify-center">
              <div className="text-gray-400 dark:text-slate-500 text-sm">{t('charts.loadingChart')}</div>
            </div>
          )}
        </div>
        
        {/* Touch interaction hints */}
        {enablePinchZoom && viewState.scale === 1 && (
          <div className="absolute bottom-2 left-2 right-2 text-center">
            <p className="text-xs text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 bg-opacity-80 rounded px-2 py-1 inline-block">
              {t('charts.pinchToZoom')}
            </p>
          </div>
        )}
        
        {/* Zoom indicator */}
        {viewState.scale !== 1 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            {Math.round(viewState.scale * 100)}%
          </div>
        )}
      </div>

      {/* Legend below chart on mobile/tablet (avoids Recharts horizontal overflow on iPad) */}
      {showLegend && typeof window !== 'undefined' && (window.innerWidth < 768 || (type === 'pie' && window.innerWidth < 1024)) && type === 'pie' && (
        <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 text-xs">
            {data.map((entry, index) => (
              <div key={index} className="flex items-center min-w-0">
                <div 
                  className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: entry.color || colors[index % colors.length] }}
                />
                <span className="truncate">{entry[nameKey]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileOptimizedChart