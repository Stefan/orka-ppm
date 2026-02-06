import React from 'react'
import { cn } from '@/lib/design-system'
import { useTranslations } from '@/lib/i18n/context'

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white'
  className?: string
}

/**
 * Reusable loading spinner component
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'primary',
  className
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  const colorClasses = {
    primary: 'text-blue-600 dark:text-blue-400',
    secondary: 'text-gray-600 dark:text-slate-400',
    white: 'text-white'
  }

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-current border-t-transparent',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
    >
    </div>
  )
}

/**
 * Full page loading component
 */
export const PageLoader: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslations()
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50">
      <div className="text-center">
        <LoadingSpinner size="xl" className="mx-auto mb-4" />
        <p className="text-gray-600 dark:text-slate-400">{message || t('common.loading')}</p>
      </div>
    </div>
  )
}

export default LoadingSpinner