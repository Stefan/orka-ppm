'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { getNetworkInfo, shouldLoadHighQuality } from '../../lib/performance'
import { Skeleton } from './SkeletonLoader'

interface NetworkAwareLoaderProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  lowBandwidthFallback?: React.ReactNode
  priority?: 'high' | 'medium' | 'low'
  minLoadTime?: number
  maxLoadTime?: number
  onLoadStart?: () => void
  onLoadComplete?: () => void
  className?: string
}

interface LoadingState {
  isLoading: boolean
  shouldLoad: boolean
  networkQuality: 'good' | 'fair' | 'poor' | 'offline'
  loadStartTime: number
}

export const NetworkAwareLoader: React.FC<NetworkAwareLoaderProps> = ({
  children,
  fallback,
  lowBandwidthFallback,
  priority = 'medium',
  minLoadTime = 300,
  maxLoadTime = 10000,
  onLoadStart,
  onLoadComplete,
  className = ''
}) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,
    shouldLoad: false,
    networkQuality: 'good',
    loadStartTime: Date.now()
  })

  const determineNetworkQuality = useCallback(() => {
    const network = getNetworkInfo()
    
    if (!navigator.onLine) return 'offline'
    if (network.saveData || network.effectiveType === 'slow-2g' || network.effectiveType === '2g') return 'poor'
    if (network.effectiveType === '3g' || network.downlink < 1.5) return 'fair'
    return 'good'
  }, [])

  const shouldLoadContent = useCallback(() => {
    const networkQuality = determineNetworkQuality()
    
    // Always load high priority content
    if (priority === 'high') return true
    
    // Skip low priority content on poor connections
    if (priority === 'low' && (networkQuality === 'poor' || networkQuality === 'offline')) {
      return false
    }
    
    // Load medium priority content on fair or better connections
    if (priority === 'medium' && networkQuality === 'offline') {
      return false
    }
    
    return true
  }, [priority, determineNetworkQuality])

  useEffect(() => {
    const networkQuality = determineNetworkQuality()
    const shouldLoad = shouldLoadContent()
    
    setLoadingState(prev => ({
      ...prev,
      networkQuality,
      shouldLoad
    }))

    if (!shouldLoad) {
      // Don't load content, but stop loading state
      setLoadingState(prev => ({
        ...prev,
        isLoading: false
      }))
      return
    }

    onLoadStart?.()
    
    // Simulate loading time based on network quality
    const baseLoadTime = minLoadTime
    const networkMultiplier = {
      good: 1,
      fair: 1.5,
      poor: 2.5,
      offline: 0
    }[networkQuality]
    
    const loadTime = Math.min(baseLoadTime * networkMultiplier, maxLoadTime)
    
    const timer = setTimeout(() => {
      setLoadingState(prev => ({
        ...prev,
        isLoading: false
      }))
      onLoadComplete?.()
    }, loadTime)

    return () => clearTimeout(timer)
  }, [shouldLoadContent, determineNetworkQuality, minLoadTime, maxLoadTime, onLoadStart, onLoadComplete])

  const renderContent = () => {
    if (loadingState.isLoading) {
      return fallback || <Skeleton className="w-full h-32" />
    }

    if (!loadingState.shouldLoad) {
      if (loadingState.networkQuality === 'poor' && lowBandwidthFallback) {
        return lowBandwidthFallback
      }
      
      if (loadingState.networkQuality === 'offline') {
        return (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-slate-400">
            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
            </svg>
            <p className="text-center">Content unavailable offline</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Please check your connection</p>
          </div>
        )
      }
      
      return (
        <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-slate-400">
          <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-center">Content not loaded</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Optimized for your connection</p>
        </div>
      )
    }

    return children
  }

  return (
    <div className={className}>
      {renderContent()}
    </div>
  )
}

// Progressive content loader with network adaptation
export const ProgressiveContentLoader: React.FC<{
  stages: Array<{
    component: React.ReactNode
    priority: 'high' | 'medium' | 'low'
    networkRequirement?: 'any' | 'fair' | 'good'
  }>
  className?: string
}> = ({ stages, className = '' }) => {
  const [loadedStages, setLoadedStages] = useState<number>(0)
  const [networkQuality, setNetworkQuality] = useState<'good' | 'fair' | 'poor' | 'offline'>('good')

  useEffect(() => {
    const network = getNetworkInfo()
    let quality: 'good' | 'fair' | 'poor' | 'offline' = 'good'
    
    if (!navigator.onLine) quality = 'offline'
    else if (network.saveData || network.effectiveType === 'slow-2g' || network.effectiveType === '2g') quality = 'poor'
    else if (network.effectiveType === '3g' || network.downlink < 1.5) quality = 'fair'
    
    setNetworkQuality(quality)
  }, [])

  useEffect(() => {
    const loadNextStage = () => {
      if (loadedStages >= stages.length) return

      const currentStage = stages[loadedStages]
      if (!currentStage) return
      
      const networkRequirement = currentStage.networkRequirement || 'any'
      
      // Check if network meets requirements
      const canLoad = 
        networkRequirement === 'any' ||
        (networkRequirement === 'fair' && ['fair', 'good'].includes(networkQuality)) ||
        (networkRequirement === 'good' && networkQuality === 'good')

      if (canLoad) {
        const delay = {
          high: 100,
          medium: 300,
          low: 500
        }[currentStage.priority]

        setTimeout(() => {
          setLoadedStages(prev => prev + 1)
        }, delay)
      }
    }

    loadNextStage()
  }, [loadedStages, stages, networkQuality])

  return (
    <div className={className}>
      {stages.slice(0, loadedStages).map((stage, index) => (
        <React.Fragment key={index}>
          {stage.component}
        </React.Fragment>
      ))}
    </div>
  )
}

// Adaptive image quality loader
export const AdaptiveImageLoader: React.FC<{
  images: {
    high: string
    medium?: string
    low?: string
  }
  alt: string
  className?: string
  width?: number
  height?: number
}> = ({ images, alt, className = '', width, height }) => {
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const network = getNetworkInfo()
    const shouldUseHighQuality = shouldLoadHighQuality()
    
    if (shouldUseHighQuality) {
      setSelectedImage(images.high)
    } else if (images.medium && (network.effectiveType === '3g' || network.downlink > 0.5)) {
      setSelectedImage(images.medium)
    } else if (images.low) {
      setSelectedImage(images.low)
    } else {
      setSelectedImage(images.high)
    }
  }, [images])

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {!isLoaded && (
        <Skeleton 
          className="absolute inset-0" 
          variant="rectangular"
          width="100%"
          height="100%"
        />
      )}
      {selectedImage && (
        <img
          src={selectedImage}
          alt={alt}
          width={width}
          height={height}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
        />
      )}
    </div>
  )
}

export default NetworkAwareLoader