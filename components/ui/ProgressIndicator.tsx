import React from 'react'
import { cn } from '@/lib/design-system'
import { Check, Loader2 } from 'lucide-react'

interface ProgressIndicatorProps {
  steps: Array<{
    label: string
    description?: string
    status: 'pending' | 'in-progress' | 'completed' | 'error'
  }>
  currentStep?: number
  className?: string
}

/**
 * Multi-step progress indicator for complex workflows
 */
export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep = 0,
  className
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = step.status === 'completed'
        const isError = step.status === 'error'
        const isInProgress = step.status === 'in-progress'
        const isLast = index === steps.length - 1

        return (
          <div key={index} className="relative">
            <div className="flex items-start gap-4">
              {/* Step indicator */}
              <div className="relative flex-shrink-0">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    isCompleted && 'bg-green-500 border-green-500',
                    isInProgress && 'bg-blue-500 border-blue-500 animate-pulse',
                    isError && 'bg-red-500 border-red-500',
                    !isCompleted && !isInProgress && !isError && 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600'
                  )}
                >
                  {isCompleted && <Check className="w-5 h-5 text-white" />}
                  {isInProgress && <Loader2 className="w-5 h-5 text-white animate-spin" />}
                  {!isCompleted && !isInProgress && (
                    <span className={cn(
                      'text-sm font-medium',
                      isError ? 'text-white' : 'text-gray-500 dark:text-slate-400'
                    )}>
                      {index + 1}
                    </span>
                  )}
                </div>
                
                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      'absolute left-5 top-10 w-0.5 h-full transition-colors',
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    )}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-8">
                <h4
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive && 'text-blue-600 dark:text-blue-400',
                    isCompleted && 'text-green-600 dark:text-green-400',
                    isError && 'text-red-600 dark:text-red-400',
                    !isActive && !isCompleted && !isError && 'text-gray-700 dark:text-slate-300'
                  )}
                >
                  {step.label}
                </h4>
                {step.description && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface LinearProgressProps {
  value: number
  max?: number
  label?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
}

/**
 * Linear progress bar for file uploads and long operations
 */
export const LinearProgress: React.FC<LinearProgressProps> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = 'md',
  variant = 'default',
  className
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }

  const variantColors = {
    default: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  }

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-gray-700 dark:text-slate-300">{label}</span>}
          {showPercentage && (
            <span className="text-gray-600 dark:text-slate-400 font-medium">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className={cn('w-full bg-gray-200 rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn(
            'h-full transition-all duration-300 ease-out rounded-full',
            variantColors[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface CircularProgressProps {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  label?: string
  showPercentage?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
}

/**
 * Circular progress indicator
 */
export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  label,
  showPercentage = true,
  variant = 'default',
  className
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percentage / 100) * circumference

  const variantColors = {
    default: 'text-blue-600 dark:text-blue-400',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400'
  }

  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-gray-200"
          />
          
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn('transition-all duration-300', variantColors[variant])}
          />
        </svg>
        
        {/* Center text */}
        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
      
      {label && (
        <span className="text-sm text-gray-600 dark:text-slate-400 text-center">{label}</span>
      )}
    </div>
  )
}

export default ProgressIndicator
