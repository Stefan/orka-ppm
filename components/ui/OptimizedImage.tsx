/**
 * OptimizedImage Component
 * 
 * A wrapper around Next.js Image component with automatic optimization:
 * - Priority loading for above-the-fold images
 * - Lazy loading for below-the-fold images
 * - Proper width/height attributes
 * - AVIF/WebP format support
 */

import Image, { ImageProps } from 'next/image'
import { useState } from 'react'

interface OptimizedImageProps extends Omit<ImageProps, 'onLoad'> {
  /**
   * Whether this image is above the fold (visible on initial page load)
   * Above-the-fold images get priority loading to optimize LCP
   */
  aboveTheFold?: boolean
  
  /**
   * Optional loading placeholder
   */
  showPlaceholder?: boolean
  
  /**
   * Callback when image loads
   */
  onLoad?: () => void
}

export function OptimizedImage({
  aboveTheFold = false,
  showPlaceholder = true,
  onLoad,
  alt,
  className = '',
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  if (hasError) {
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="text-gray-400 text-sm">Image unavailable</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {showPlaceholder && isLoading && (
        <div 
          className={`absolute inset-0 bg-gray-200 animate-pulse ${className}`}
          aria-hidden="true"
        />
      )}
      <Image
        {...props}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        priority={aboveTheFold}
        loading={aboveTheFold ? undefined : 'lazy'}
        onLoad={handleLoad}
        onError={handleError}
        // Ensure proper image formats are used
        quality={90}
      />
    </div>
  )
}

/**
 * Optimized Avatar Component
 * For user avatars and profile pictures
 */
export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  className = '',
  aboveTheFold = false,
}: {
  src: string
  alt: string
  size?: number
  className?: string
  aboveTheFold?: boolean
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      aboveTheFold={aboveTheFold}
      showPlaceholder={true}
    />
  )
}

/**
 * Optimized Logo Component
 * For company logos and brand images
 */
export function OptimizedLogo({
  src,
  alt,
  width,
  height,
  className = '',
  priority = true, // Logos are typically above the fold
}: {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      aboveTheFold={priority}
      showPlaceholder={false}
    />
  )
}
