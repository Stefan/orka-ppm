/**
 * CLS-Safe Container Component
 * 
 * Prevents Cumulative Layout Shift by reserving space before content loads
 */

'use client'

import React from 'react'
import { cn } from '../../lib/utils/design-system'

interface CLSSafeContainerProps {
  children: React.ReactNode
  minHeight?: string | number
  aspectRatio?: string
  className?: string
  /**
   * Whether to use CSS containment for better performance
   */
  useContainment?: boolean
  /**
   * Reserve space even when empty
   */
  reserveSpace?: boolean
}

export const CLSSafeContainer: React.FC<CLSSafeContainerProps> = ({
  children,
  minHeight,
  aspectRatio,
  className,
  useContainment = true,
  reserveSpace = true
}) => {
  const style: React.CSSProperties = {
    ...(minHeight && { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }),
    ...(aspectRatio && { aspectRatio }),
    ...(useContainment && { contain: 'layout style paint' }),
    ...(reserveSpace && { display: 'block' })
  }

  return (
    <div
      className={cn('cls-safe-container', className)}
      style={style}
    >
      {children}
    </div>
  )
}

/**
 * CLS-Safe Image Wrapper
 * Ensures images don't cause layout shifts
 */
interface CLSSafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  width?: number
  height?: number
  aspectRatio?: string
  priority?: boolean
}

export const CLSSafeImage: React.FC<CLSSafeImageProps> = ({
  src,
  alt,
  width,
  height,
  aspectRatio,
  priority = false,
  className,
  ...props
}) => {
  // Calculate aspect ratio if width and height are provided
  const calculatedAspectRatio = aspectRatio || 
    (width && height ? `${width} / ${height}` : '16 / 9')

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        aspectRatio: calculatedAspectRatio,
        contain: 'layout style paint',
        // Reserve space to prevent CLS
        minHeight: height || 'auto',
        minWidth: width || 'auto'
      }}
    >
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          aspectRatio: calculatedAspectRatio
        }}
        {...props}
      />
    </div>
  )
}

/**
 * CLS-Safe Fixed Element
 * For fixed positioned elements that shouldn't cause shifts
 */
interface CLSSafeFixedProps {
  children: React.ReactNode
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  className?: string
  offset?: number
}

export const CLSSafeFixed: React.FC<CLSSafeFixedProps> = ({
  children,
  position,
  className,
  offset = 16
}) => {
  const positionClasses = {
    'top-left': `top-${offset} left-${offset}`,
    'top-right': `top-${offset} right-${offset}`,
    'bottom-left': `bottom-${offset} left-${offset}`,
    'bottom-right': `bottom-${offset} right-${offset}`
  }

  return (
    <div
      className={cn(
        'fixed z-50',
        positionClasses[position],
        className
      )}
      style={{
        willChange: 'transform',
        transform: 'translateZ(0)',
        contain: 'layout style paint'
      }}
    >
      {children}
    </div>
  )
}

export default CLSSafeContainer
