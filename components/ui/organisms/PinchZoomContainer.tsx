import React, { useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/design-system'
import { useTouchGestures, type TouchPoint } from '@/hooks/useTouchGestures'

/**
 * PinchZoomContainer Component
 * 
 * Provides pinch-to-zoom functionality for charts, images, and other content
 * Features:
 * - Smooth pinch-to-zoom with momentum
 * - Pan support when zoomed in
 * - Double-tap to zoom
 * - Reset zoom functionality
 * - Boundary constraints
 */

interface PinchZoomContainerProps {
  children: React.ReactNode
  className?: string
  /** Minimum zoom scale */
  minScale?: number
  /** Maximum zoom scale */
  maxScale?: number
  /** Initial zoom scale */
  initialScale?: number
  /** Enable double-tap to zoom */
  doubleTapZoom?: boolean
  /** Double-tap zoom scale */
  doubleTapScale?: number
  /** Animation duration for zoom transitions */
  animationDuration?: number
  /** Callback when zoom changes */
  onZoomChange?: (scale: number) => void
  /** Callback when pan changes */
  onPanChange?: (x: number, y: number) => void
  'data-testid'?: string
}

export type { PinchZoomContainerProps }

export const PinchZoomContainer: React.FC<PinchZoomContainerProps> = ({
  children,
  className,
  minScale = 0.5,
  maxScale = 4,
  initialScale = 1,
  doubleTapZoom = true,
  doubleTapScale = 2,
  animationDuration = 300,
  onZoomChange,
  onPanChange,
  'data-testid': dataTestId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  
  const [scale, setScale] = useState(initialScale)
  const [translateX, setTranslateX] = useState(0)
  const [translateY, setTranslateY] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Constrain values within bounds
  const constrainScale = useCallback((newScale: number): number => {
    return Math.max(minScale, Math.min(maxScale, newScale))
  }, [minScale, maxScale])

  const constrainTranslation = useCallback((x: number, y: number, currentScale: number) => {
    if (!containerRef.current || !contentRef.current) return { x, y }

    const containerRect = containerRef.current.getBoundingClientRect()
    const contentRect = contentRef.current.getBoundingClientRect()
    
    const scaledWidth = contentRect.width * currentScale
    const scaledHeight = contentRect.height * currentScale
    
    const maxX = Math.max(0, (scaledWidth - containerRect.width) / 2)
    const maxY = Math.max(0, (scaledHeight - containerRect.height) / 2)
    
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    }
  }, [])

  // Reset zoom and pan
  const resetZoom = useCallback(() => {
    setIsAnimating(true)
    setScale(initialScale)
    setTranslateX(0)
    setTranslateY(0)
    onZoomChange?.(initialScale)
    onPanChange?.(0, 0)
    
    setTimeout(() => setIsAnimating(false), animationDuration)
  }, [initialScale, animationDuration, onZoomChange, onPanChange])

  // Handle pinch zoom
  const handlePinchStart = useCallback((_newScale: number, _center: TouchPoint) => {
    setIsAnimating(false)
  }, [])

  const handlePinchMove = useCallback((newScale: number, _center: TouchPoint, _delta: number) => {
    const constrainedScale = constrainScale(newScale)
    setScale(constrainedScale)
    onZoomChange?.(constrainedScale)
  }, [constrainScale, onZoomChange])

  const handlePinchEnd = useCallback((finalScale: number, _center: TouchPoint) => {
    const constrainedScale = constrainScale(finalScale)
    setScale(constrainedScale)
    onZoomChange?.(constrainedScale)
  }, [constrainScale, onZoomChange])

  // Handle double-tap zoom
  const handleDoubleTap = useCallback((point: TouchPoint) => {
    if (!doubleTapZoom) return

    setIsAnimating(true)
    
    const newScale = scale === initialScale ? doubleTapScale : initialScale
    const constrainedScale = constrainScale(newScale)
    
    setScale(constrainedScale)
    onZoomChange?.(constrainedScale)
    
    // Center on tap point if zooming in
    if (constrainedScale > initialScale && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const centerX = containerRect.width / 2
      const centerY = containerRect.height / 2
      
      const newTranslateX = (centerX - point.x) * (constrainedScale - 1)
      const newTranslateY = (centerY - point.y) * (constrainedScale - 1)
      
      const constrained = constrainTranslation(newTranslateX, newTranslateY, constrainedScale)
      setTranslateX(constrained.x)
      setTranslateY(constrained.y)
      onPanChange?.(constrained.x, constrained.y)
    } else {
      setTranslateX(0)
      setTranslateY(0)
      onPanChange?.(0, 0)
    }
    
    setTimeout(() => setIsAnimating(false), animationDuration)
  }, [
    doubleTapZoom,
    scale,
    initialScale,
    doubleTapScale,
    constrainScale,
    constrainTranslation,
    animationDuration,
    onZoomChange,
    onPanChange,
  ])

  // Handle pan (when zoomed in)
  const handleSwipe = useCallback((direction: 'up' | 'down' | 'left' | 'right', _velocity: number, distance: number) => {
    if (scale <= 1) return // Only pan when zoomed in

    const panDistance = Math.min(distance, 100) // Limit pan distance
    let deltaX = 0
    let deltaY = 0

    switch (direction) {
      case 'left':
        deltaX = -panDistance
        break
      case 'right':
        deltaX = panDistance
        break
      case 'up':
        deltaY = -panDistance
        break
      case 'down':
        deltaY = panDistance
        break
    }

    const newTranslateX = translateX + deltaX
    const newTranslateY = translateY + deltaY
    const constrained = constrainTranslation(newTranslateX, newTranslateY, scale)
    
    setTranslateX(constrained.x)
    setTranslateY(constrained.y)
    onPanChange?.(constrained.x, constrained.y)
  }, [scale, translateX, translateY, constrainTranslation, onPanChange])

  // Touch gesture setup
  const { elementRef } = useTouchGestures({
    onPinchStart: handlePinchStart,
    onPinchMove: handlePinchMove,
    onPinchEnd: handlePinchEnd,
    onDoubleTap: handleDoubleTap,
    onSwipe: handleSwipe,
  }, {
    pinchSensitivity: 1,
    doubleTapInterval: 300,
    doubleTapDistance: 30,
    hapticFeedback: true,
  })

  // Combine refs
  const setRefs = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
    if (elementRef) {
      elementRef.current = element
    }
  }, [elementRef])

  const transformStyle = {
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    transition: isAnimating ? `transform ${animationDuration}ms ease-out` : 'none',
    transformOrigin: 'center center',
  }

  return (
    <div
      ref={setRefs}
      className={cn(
        'relative overflow-hidden touch-none select-none',
        'bg-gray-50 dark:bg-slate-800/50 rounded-lg',
        className
      )}
      data-testid={dataTestId || 'pinch-zoom-container'}
    >
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
        <button
          onClick={() => {
            const newScale = constrainScale(scale * 1.2)
            setScale(newScale)
            onZoomChange?.(newScale)
          }}
          className="w-10 h-10 bg-white dark:bg-slate-800 bg-opacity-90 rounded-full shadow-md flex items-center justify-center hover:bg-opacity-100 transition-all"
          aria-label="Zoom in"
        >
          <span className="text-lg font-bold text-gray-700 dark:text-slate-300">+</span>
        </button>
        <button
          onClick={() => {
            const newScale = constrainScale(scale / 1.2)
            setScale(newScale)
            onZoomChange?.(newScale)
          }}
          className="w-10 h-10 bg-white dark:bg-slate-800 bg-opacity-90 rounded-full shadow-md flex items-center justify-center hover:bg-opacity-100 transition-all"
          aria-label="Zoom out"
        >
          <span className="text-lg font-bold text-gray-700 dark:text-slate-300">−</span>
        </button>
        {(scale !== initialScale || translateX !== 0 || translateY !== 0) && (
          <button
            onClick={resetZoom}
            className="w-10 h-10 bg-white dark:bg-slate-800 bg-opacity-90 rounded-full shadow-md flex items-center justify-center hover:bg-opacity-100 transition-all"
            aria-label="Reset zoom"
          >
            <span className="text-xs font-bold text-gray-700 dark:text-slate-300">⌂</span>
          </button>
        )}
      </div>

      {/* Zoom indicator */}
      {scale !== initialScale && (
        <div className="absolute bottom-4 left-4 z-10 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
          {Math.round(scale * 100)}%
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        style={transformStyle}
        className="w-full h-full"
      >
        {children}
      </div>
    </div>
  )
}

export default PinchZoomContainer