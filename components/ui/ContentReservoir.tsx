'use client'

import React, { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils/design-system'

interface ContentReservoirProps {
  children: React.ReactNode
  reserveHeight?: number | string
  reserveWidth?: number | string
  className?: string
  onContentLoad?: () => void
}

/**
 * ContentReservoir prevents CLS by reserving space for dynamic content
 * Uses CSS containment for better performance isolation
 */
export function ContentReservoir({
  children,
  reserveHeight = 'auto',
  reserveWidth = '100%',
  className,
  onContentLoad
}: ContentReservoirProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    // Check if content is already loaded (images, etc.)
    const images = containerRef.current.querySelectorAll('img')
    const videos = containerRef.current.querySelectorAll('video')

    if (images.length === 0 && videos.length === 0) {
      // No async content, mark as loaded immediately
      setIsLoaded(true)
      onContentLoad?.()
      return
    }

    let loadedCount = 0
    const totalCount = images.length + videos.length

    const checkAllLoaded = () => {
      loadedCount++
      if (loadedCount === totalCount) {
        setIsLoaded(true)
        onContentLoad?.()
      }
    }

    // Monitor image loading
    images.forEach((img) => {
      if (img.complete) {
        checkAllLoaded()
      } else {
        img.addEventListener('load', checkAllLoaded)
        img.addEventListener('error', checkAllLoaded) // Count errors as loaded too
      }
    })

    // Monitor video loading
    videos.forEach((video) => {
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
        checkAllLoaded()
      } else {
        video.addEventListener('loadeddata', checkAllLoaded)
        video.addEventListener('error', checkAllLoaded)
      }
    })

    // Timeout fallback (10 seconds)
    const timeout = setTimeout(() => {
      if (!isLoaded) {
        setIsLoaded(true)
        onContentLoad?.()
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [onContentLoad, isLoaded])

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={{
        // Reserve space to prevent CLS - keep it consistent
        minHeight: typeof reserveHeight === 'number' ? `${reserveHeight}px` : reserveHeight,
        minWidth: typeof reserveWidth === 'number' ? `${reserveWidth}px` : reserveWidth,
        // CSS containment for performance
        contain: 'layout style paint'
        // Removed transition to prevent layout shifts
      }}
    >
      {children}
    </div>
  )
}

// Specialized reservoir for common content types
export function ImageReservoir({
  src,
  alt,
  className,
  width,
  height,
  ...props
}: {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
} & React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <ContentReservoir
      reserveHeight={height || 200}
      reserveWidth={width || '100%'}
      className={className}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        style={{
          // Ensure image doesn't exceed reserved space
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'cover'
        }}
        {...props}
      />
    </ContentReservoir>
  )
}

export function CardReservoir({
  children,
  className,
  minHeight = 200
}: {
  children: React.ReactNode
  className?: string
  minHeight?: number
}) {
  return (
    <ContentReservoir
      reserveHeight={minHeight}
      className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}
    >
      {children}
    </ContentReservoir>
  )
}

export default ContentReservoir