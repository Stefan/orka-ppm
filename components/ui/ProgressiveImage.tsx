'use client'

import React, { useState, useRef, useEffect } from 'react'
import { getNetworkInfo, shouldLoadHighQuality } from '@/lib/performance'

interface ProgressiveImageProps {
  src: string
  lowQualitySrc?: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  onLoad?: () => void
  onError?: () => void
  placeholder?: 'blur' | 'skeleton' | 'none'
  blurDataURL?: string
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  lowQualitySrc,
  alt,
  width,
  height,
  className = '',
  priority = false,
  onLoad,
  onError,
  placeholder = 'skeleton',
  blurDataURL
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [currentSrc, setCurrentSrc] = useState<string>('')
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Determine which image to load based on network conditions
  useEffect(() => {
    if (!isInView) return

    const network = getNetworkInfo()
    const shouldUseHighQuality = shouldLoadHighQuality()
    
    // Use low quality image on slow connections or save-data mode
    if (!shouldUseHighQuality && lowQualitySrc) {
      setCurrentSrc(lowQualitySrc)
    } else {
      setCurrentSrc(src)
    }
  }, [isInView, src, lowQualitySrc])

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            observerRef.current?.unobserve(entry.target)
          }
        })
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [priority])

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  const renderPlaceholder = () => {
    if (placeholder === 'none') return null

    if (placeholder === 'blur' && blurDataURL) {
      return (
        <img
          src={blurDataURL}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ filter: 'blur(10px)' }}
        />
      )
    }

    if (placeholder === 'skeleton') {
      return (
        <div
          className={`absolute inset-0 bg-gray-200 animate-pulse transition-opacity duration-300 ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )
    }

    return null
  }

  const renderErrorState = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  )

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {hasError ? (
        renderErrorState()
      ) : (
        <>
          {renderPlaceholder()}
          {currentSrc && (
            <img
              ref={imgRef}
              src={currentSrc}
              alt={alt}
              width={width}
              height={height}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={handleLoad}
              onError={handleError}
              loading={priority ? 'eager' : 'lazy'}
            />
          )}
        </>
      )}
    </div>
  )
}

// Hook for progressive image loading
export const useProgressiveImage = (src: string, lowQualitySrc?: string) => {
  const [currentSrc, setCurrentSrc] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const network = getNetworkInfo()
    const shouldUseHighQuality = shouldLoadHighQuality()
    
    // Start with low quality if available
    if (lowQualitySrc && !shouldUseHighQuality) {
      setCurrentSrc(lowQualitySrc)
      
      // Preload high quality image in background
      const highQualityImg = new Image()
      highQualityImg.onload = () => {
        setCurrentSrc(src)
        setIsLoaded(true)
      }
      highQualityImg.src = src
    } else {
      setCurrentSrc(src)
    }
  }, [src, lowQualitySrc])

  return { currentSrc, isLoaded }
}

export default ProgressiveImage