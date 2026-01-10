import { useRef, useCallback, useState, useEffect } from 'react'

/**
 * Touch Gesture Recognition Hook
 * 
 * Provides comprehensive touch gesture recognition including:
 * - Pinch-to-zoom for charts and images
 * - Long-press detection for contextual menus
 * - Pull-to-refresh mechanism for data lists
 * - Swipe gestures with direction detection
 * - Tap and double-tap recognition
 */

export interface TouchPoint {
  x: number
  y: number
  timestamp: number
}

export interface GestureState {
  isActive: boolean
  startTime: number
  startPoints: TouchPoint[]
  currentPoints: TouchPoint[]
  velocity: { x: number; y: number }
  distance: number
  scale: number
  rotation: number
  center: TouchPoint
}

export interface GestureCallbacks {
  onTap?: (point: TouchPoint) => void
  onDoubleTap?: (point: TouchPoint) => void
  onLongPress?: (point: TouchPoint) => void
  onSwipe?: (direction: 'up' | 'down' | 'left' | 'right', velocity: number, distance: number) => void
  onPinchStart?: (scale: number, center: TouchPoint) => void
  onPinchMove?: (scale: number, center: TouchPoint, delta: number) => void
  onPinchEnd?: (scale: number, center: TouchPoint) => void
  onPullToRefresh?: (distance: number, threshold: number) => void
  onPullToRefreshTrigger?: () => void
  onRotate?: (rotation: number, center: TouchPoint) => void
}

export interface GestureOptions {
  /** Minimum distance for swipe detection (px) */
  swipeThreshold?: number
  /** Minimum velocity for swipe detection (px/ms) */
  swipeVelocityThreshold?: number
  /** Long press duration (ms) */
  longPressDuration?: number
  /** Double tap max interval (ms) */
  doubleTapInterval?: number
  /** Double tap max distance (px) */
  doubleTapDistance?: number
  /** Pinch sensitivity */
  pinchSensitivity?: number
  /** Pull to refresh threshold (px) */
  pullToRefreshThreshold?: number
  /** Enable haptic feedback */
  hapticFeedback?: boolean
  /** Prevent default touch behaviors */
  preventDefault?: boolean
}

const defaultOptions: Required<GestureOptions> = {
  swipeThreshold: 50,
  swipeVelocityThreshold: 0.3,
  longPressDuration: 500,
  doubleTapInterval: 300,
  doubleTapDistance: 30,
  pinchSensitivity: 1,
  pullToRefreshThreshold: 80,
  hapticFeedback: true,
  preventDefault: true,
}

export const useTouchGestures = (
  callbacks: GestureCallbacks = {},
  options: GestureOptions = {}
) => {
  const opts = { ...defaultOptions, ...options }
  const elementRef = useRef<HTMLElement>(null)
  
  // Gesture state
  const [gestureState, setGestureState] = useState<GestureState>({
    isActive: false,
    startTime: 0,
    startPoints: [],
    currentPoints: [],
    velocity: { x: 0, y: 0 },
    distance: 0,
    scale: 1,
    rotation: 0,
    center: { x: 0, y: 0, timestamp: 0 },
  })

  // Timers and state
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const lastTapTime = useRef(0)
  const lastTapPoint = useRef<TouchPoint | null>(null)
  const initialDistance = useRef(0)
  const initialScale = useRef(1)
  const initialRotation = useRef(0)

  // Utility functions
  const getDistance = useCallback((p1: TouchPoint, p2: TouchPoint): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
  }, [])

  const getCenter = useCallback((points: TouchPoint[]): TouchPoint => {
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length
    return { x, y, timestamp: Date.now() }
  }, [])

  const getAngle = useCallback((p1: TouchPoint, p2: TouchPoint): number => {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI
  }, [])

  const getVelocity = useCallback((start: TouchPoint, end: TouchPoint): { x: number; y: number } => {
    const deltaTime = end.timestamp - start.timestamp
    if (deltaTime === 0) return { x: 0, y: 0 }
    
    return {
      x: (end.x - start.x) / deltaTime,
      y: (end.y - start.y) / deltaTime,
    }
  }, [])

  const triggerHapticFeedback = useCallback((intensity: number = 10) => {
    if (!opts.hapticFeedback) return

    if ('vibrator' in navigator || 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(intensity)
      } catch (error) {
        // Silently fail
      }
    }
  }, [opts.hapticFeedback])

  const getTouchPoints = useCallback((touches: TouchList): TouchPoint[] => {
    return Array.from(touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now(),
    }))
  }, [])

  // Touch event handlers
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (opts.preventDefault) {
      e.preventDefault()
    }

    const points = getTouchPoints(e.touches)
    const now = Date.now()

    setGestureState(prev => ({
      ...prev,
      isActive: true,
      startTime: now,
      startPoints: points,
      currentPoints: points,
      center: getCenter(points),
    }))

    // Initialize multi-touch values
    if (points.length === 2) {
      initialDistance.current = getDistance(points[0], points[1])
      initialScale.current = 1
      initialRotation.current = getAngle(points[0], points[1])
    }

    // Long press detection
    if (points.length === 1) {
      longPressTimer.current = setTimeout(() => {
        callbacks.onLongPress?.(points[0])
        triggerHapticFeedback(20)
      }, opts.longPressDuration)
    }
  }, [
    opts.preventDefault,
    opts.longPressDuration,
    getTouchPoints,
    getCenter,
    getDistance,
    getAngle,
    callbacks.onLongPress,
    triggerHapticFeedback,
  ])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (opts.preventDefault) {
      e.preventDefault()
    }

    const points = getTouchPoints(e.touches)
    const center = getCenter(points)

    setGestureState(prev => {
      const newState = {
        ...prev,
        currentPoints: points,
        center,
      }

      // Clear long press timer on movement
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      // Handle pinch gesture
      if (points.length === 2 && prev.startPoints.length === 2) {
        const currentDistance = getDistance(points[0], points[1])
        const scale = currentDistance / initialDistance.current
        const rotation = getAngle(points[0], points[1]) - initialRotation.current

        newState.scale = scale
        newState.rotation = rotation

        // Pinch callbacks
        if (Math.abs(scale - 1) > 0.1) {
          if (prev.scale === 1) {
            callbacks.onPinchStart?.(scale, center)
          } else {
            callbacks.onPinchMove?.(scale, center, scale - prev.scale)
          }
        }

        // Rotation callback
        if (Math.abs(rotation) > 5) {
          callbacks.onRotate?.(rotation, center)
        }
      }

      // Handle pull-to-refresh (single touch, vertical movement from top)
      if (points.length === 1 && prev.startPoints.length === 1) {
        const deltaY = points[0].y - prev.startPoints[0].y
        const deltaX = Math.abs(points[0].x - prev.startPoints[0].x)
        
        // Check if it's a vertical pull from near the top
        if (deltaY > 0 && deltaX < 30 && prev.startPoints[0].y < 100) {
          callbacks.onPullToRefresh?.(deltaY, opts.pullToRefreshThreshold)
          
          if (deltaY > opts.pullToRefreshThreshold) {
            triggerHapticFeedback(15)
          }
        }
      }

      return newState
    })
  }, [
    opts.preventDefault,
    opts.pullToRefreshThreshold,
    getTouchPoints,
    getCenter,
    getDistance,
    getAngle,
    callbacks.onPinchStart,
    callbacks.onPinchMove,
    callbacks.onRotate,
    callbacks.onPullToRefresh,
    triggerHapticFeedback,
  ])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (opts.preventDefault) {
      e.preventDefault()
    }

    const now = Date.now()
    
    setGestureState(prev => {
      const duration = now - prev.startTime
      const endPoints = prev.currentPoints

      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      // Handle pinch end
      if (prev.scale !== 1) {
        callbacks.onPinchEnd?.(prev.scale, prev.center)
      }

      // Handle tap and double tap
      if (prev.startPoints.length === 1 && endPoints.length === 1 && duration < 200) {
        const point = endPoints[0]
        const startPoint = prev.startPoints[0]
        const distance = getDistance(startPoint, point)

        if (distance < 10) { // Minimal movement for tap
          const timeSinceLastTap = now - lastTapTime.current
          const lastPoint = lastTapPoint.current

          if (
            timeSinceLastTap < opts.doubleTapInterval &&
            lastPoint &&
            getDistance(point, lastPoint) < opts.doubleTapDistance
          ) {
            // Double tap
            callbacks.onDoubleTap?.(point)
            triggerHapticFeedback(15)
            lastTapTime.current = 0 // Reset to prevent triple tap
          } else {
            // Single tap
            callbacks.onTap?.(point)
            lastTapTime.current = now
            lastTapPoint.current = point
          }
        }
      }

      // Handle swipe
      if (prev.startPoints.length === 1 && endPoints.length === 1) {
        const startPoint = prev.startPoints[0]
        const endPoint = endPoints[0]
        const distance = getDistance(startPoint, endPoint)
        const velocity = getVelocity(startPoint, endPoint)
        const velocityMagnitude = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y)

        if (distance > opts.swipeThreshold && velocityMagnitude > opts.swipeVelocityThreshold) {
          const deltaX = endPoint.x - startPoint.x
          const deltaY = endPoint.y - startPoint.y
          
          let direction: 'up' | 'down' | 'left' | 'right'
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left'
          } else {
            direction = deltaY > 0 ? 'down' : 'up'
          }

          callbacks.onSwipe?.(direction, velocityMagnitude, distance)
          triggerHapticFeedback(12)
        }
      }

      // Handle pull-to-refresh trigger
      if (prev.startPoints.length === 1 && endPoints.length === 1) {
        const deltaY = endPoints[0].y - prev.startPoints[0].y
        if (deltaY > opts.pullToRefreshThreshold && prev.startPoints[0].y < 100) {
          callbacks.onPullToRefreshTrigger?.()
          triggerHapticFeedback(25)
        }
      }

      return {
        isActive: false,
        startTime: 0,
        startPoints: [],
        currentPoints: [],
        velocity: { x: 0, y: 0 },
        distance: 0,
        scale: 1,
        rotation: 0,
        center: { x: 0, y: 0, timestamp: 0 },
      }
    })

    // Reset multi-touch values
    initialDistance.current = 0
    initialScale.current = 1
    initialRotation.current = 0
  }, [
    opts.preventDefault,
    opts.swipeThreshold,
    opts.swipeVelocityThreshold,
    opts.doubleTapInterval,
    opts.doubleTapDistance,
    opts.pullToRefreshThreshold,
    getDistance,
    getVelocity,
    callbacks.onPinchEnd,
    callbacks.onTap,
    callbacks.onDoubleTap,
    callbacks.onSwipe,
    callbacks.onPullToRefreshTrigger,
    triggerHapticFeedback,
  ])

  // Attach event listeners
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: !opts.preventDefault })
    element.addEventListener('touchmove', handleTouchMove, { passive: !opts.preventDefault })
    element.addEventListener('touchend', handleTouchEnd, { passive: !opts.preventDefault })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, opts.preventDefault])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [])

  return {
    elementRef,
    gestureState,
    isGestureActive: gestureState.isActive,
  }
}

export default useTouchGestures