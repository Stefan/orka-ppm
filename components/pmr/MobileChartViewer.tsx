'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  X,
  RotateCcw
} from 'lucide-react'

import { useTouchGestures } from '@/hooks/useTouchGestures'

export interface MobileChartViewerProps {
  chartData: any
  chartType: 'line' | 'bar' | 'pie' | 'scatter'
  title: string
  onClose?: () => void
  onExport?: () => void
  className?: string
}

const MobileChartViewer: React.FC<MobileChartViewerProps> = ({
  chartData,
  chartType,
  title,
  onClose,
  onExport,
  className = ''
}) => {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  // Touch gestures for pinch-to-zoom and pan
  const { elementRef, gestureState } = useTouchGestures({
    onPinchStart: (initialScale) => {
      console.log('Pinch started:', initialScale)
    },
    onPinchMove: (newScale, center, delta) => {
      setScale(prev => Math.max(0.5, Math.min(3, prev + delta)))
    },
    onPinchEnd: (finalScale) => {
      console.log('Pinch ended:', finalScale)
    },
    onDoubleTap: (point) => {
      // Double tap to zoom in/out
      setScale(prev => prev === 1 ? 2 : 1)
      if (scale !== 1) {
        setPosition({ x: 0, y: 0 })
      }
    }
  }, {
    pinchSensitivity: 1,
    hapticFeedback: true
  })

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(3, prev + 0.25))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(0.5, prev - 0.25))
  }, [])

  const handleReset = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen()
      }
    } else if (document.fullscreenElement) {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }, [isFullscreen])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full bg-white ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h3 className="text-base font-semibold text-gray-900 truncate flex-1">
          {title}
        </h3>

        <div className="flex items-center space-x-2 ml-2">
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
              title="Export chart"
            >
              <Download className="h-5 w-5" />
            </button>
          )}
          
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
            title="Toggle fullscreen"
          >
            <Maximize2 className="h-5 w-5" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Chart Container */}
      <div
        ref={elementRef as React.RefObject<HTMLDivElement>}
        className="flex-1 overflow-hidden relative bg-gray-50"
      >
        <div
          ref={chartRef}
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transition: gestureState.isActive ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          {/* Placeholder for actual chart component */}
          <div className="w-full h-full p-4">
            <div className="w-full h-full bg-white rounded-lg shadow-sm border border-gray-200 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-300 mb-2">
                  {chartType.toUpperCase()}
                </div>
                <p className="text-sm text-gray-500">
                  Chart visualization would render here
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Pinch to zoom • Double tap to reset
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Zoom Indicator */}
        {scale !== 1 && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-black bg-opacity-75 text-white text-xs rounded-full">
            {Math.round(scale * 100)}%
          </div>
        )}

        {/* Gesture Hint */}
        {!gestureState.isActive && scale === 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black bg-opacity-75 text-white text-xs rounded-full whitespace-nowrap">
            Pinch to zoom • Double tap to zoom in
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center justify-center space-x-2 p-4 border-t border-gray-200 bg-white">
        <button
          onClick={handleZoomOut}
          disabled={scale <= 0.5}
          className="p-3 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
          title="Zoom out"
        >
          <ZoomOut className="h-5 w-5" />
        </button>

        <div className="flex-1 max-w-xs">
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <button
          onClick={handleZoomIn}
          disabled={scale >= 3}
          className="p-3 text-gray-600 hover:bg-gray-100 rounded-md disabled:opacity-30 disabled:cursor-not-allowed"
          title="Zoom in"
        >
          <ZoomIn className="h-5 w-5" />
        </button>

        <button
          onClick={handleReset}
          className="p-3 text-gray-600 hover:bg-gray-100 rounded-md"
          title="Reset zoom"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
      </div>

      {/* Scale Display */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-center">
        <span className="text-xs text-gray-600">
          Zoom: {Math.round(scale * 100)}%
        </span>
      </div>
    </div>
  )
}

export default MobileChartViewer
