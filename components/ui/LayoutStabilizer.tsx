/**
 * Layout Stabilizer Component
 * Helps prevent Cumulative Layout Shift (CLS) by reserving space for dynamic content
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'

interface LayoutStabilizerProps {
  children: React.ReactNode
  minHeight?: number | string
  minWidth?: number | string
  aspectRatio?: string
  reserveSpace?: boolean
  className?: string
}

/**
 * LayoutStabilizer component that helps prevent CLS by reserving space for dynamic content
 */
export function LayoutStabilizer({
  children,
  minHeight,
  minWidth,
  aspectRatio,
  reserveSpace = true,
  className = ''
}: LayoutStabilizerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (!reserveSpace || !containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        })
      }
    })

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [reserveSpace])

  const containerStyle: React.CSSProperties = {
    minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
    minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth,
    aspectRatio: aspectRatio,
    ...(dimensions && reserveSpace ? {
      minHeight: Math.max(dimensions.height, typeof minHeight === 'number' ? minHeight : 0),
      minWidth: Math.max(dimensions.width, typeof minWidth === 'number' ? minWidth : 0)
    } : {})
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
    >
      {children}
    </div>
  )
}

interface ImageWithStabilizedLayoutProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  aspectRatio?: string
  fallbackHeight?: number
  fallbackWidth?: number
}

/**
 * Image component with built-in layout stabilization
 */
export function ImageWithStabilizedLayout({
  src,
  alt,
  aspectRatio = '16/9',
  fallbackHeight = 200,
  fallbackWidth = 300,
  className = '',
  style,
  ...props
}: ImageWithStabilizedLayoutProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  const containerStyle: React.CSSProperties = {
    aspectRatio,
    minHeight: fallbackHeight,
    minWidth: fallbackWidth,
    ...style
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={containerStyle}
    >
      {!hasError ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-300"
          style={{
            opacity: isLoaded ? 1 : 0
          }}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          loading="lazy"
          {...props}
        />
      ) : (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="text-gray-400 text-sm">Image not available</div>
        </div>
      )}
      
      {/* Loading placeholder */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}
    </div>
  )
}

interface ConditionalContentProps {
  show: boolean
  children: React.ReactNode
  placeholder?: React.ReactNode
  reserveSpace?: boolean
  minHeight?: number | string
  className?: string
}

/**
 * Component for conditional content that prevents layout shifts
 */
export function ConditionalContent({
  show,
  children,
  placeholder,
  reserveSpace = true,
  minHeight,
  className = ''
}: ConditionalContentProps) {
  if (!reserveSpace) {
    return show ? <>{children}</> : null
  }

  const containerStyle: React.CSSProperties = {
    minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight,
    visibility: show ? 'visible' : 'hidden',
    height: show ? 'auto' : minHeight || 'auto'
  }

  return (
    <div className={className} style={containerStyle}>
      {show ? children : placeholder}
    </div>
  )
}

export default LayoutStabilizer