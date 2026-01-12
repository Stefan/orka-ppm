import React from 'react'
import { cn, a11y } from '@/lib/design-system'
import type { ComponentProps } from '@/types'

export interface TypographyProps extends ComponentProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div'
  variant?: 'display' | 'heading' | 'body' | 'caption' | 'label'
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'gray'
  align?: 'left' | 'center' | 'right' | 'justify'
  truncate?: boolean
  responsive?: boolean
  'aria-level'?: number
}

/**
 * FlexibleTypography - Atomic design component for responsive text scaling
 * Provides consistent typography with mobile-first responsive scaling
 */
export const FlexibleTypography: React.FC<TypographyProps> = ({
  as: Component = 'p',
  variant = 'body',
  size,
  weight,
  color = 'gray',
  align = 'left',
  truncate = false,
  responsive = false,
  children,
  className,
  'aria-level': ariaLevel,
  ...props
}) => {
  const variantClasses = {
    display: responsive ? 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold' : 'text-3xl sm:text-4xl lg:text-5xl font-bold',
    heading: responsive ? 'text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold' : 'text-xl sm:text-2xl lg:text-3xl font-semibold',
    body: responsive ? 'text-sm sm:text-base leading-relaxed' : 'text-base leading-relaxed',
    caption: 'text-sm text-gray-500',
    label: 'text-sm font-medium',
  }

  const sizeClasses = size ? {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl',
  }[size] : ''

  const weightClasses = weight ? {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold',
  }[weight] : ''

  const colorClasses = {
    primary: 'text-primary-600',
    secondary: 'text-gray-600',
    success: 'text-success-600',
    warning: 'text-warning-600',
    error: 'text-error-600',
    gray: 'text-gray-900',
  }

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
  }

  return (
    <Component
      className={cn(
        size ? sizeClasses : variantClasses[variant],
        weightClasses,
        colorClasses[color],
        alignClasses[align],
        truncate && 'truncate',
        a11y.highContrast,
        className
      )}
      aria-level={ariaLevel}
      {...props}
    >
      {children}
    </Component>
  )
}

export default FlexibleTypography