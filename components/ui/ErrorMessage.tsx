import React from 'react'
import { cn } from '@/lib/design-system'
import { AlertCircle, AlertTriangle, Info, CheckCircle, X } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/context'

interface ErrorMessageProps {
  title?: string
  message: string
  type?: 'error' | 'warning' | 'info' | 'success'
  actionable?: boolean
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: 'primary' | 'secondary'
  }>
  onDismiss?: () => void
  className?: string
}

/**
 * Enhanced error message component with actionable guidance
 * Provides clear, user-friendly error messages with suggested actions
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title,
  message,
  type = 'error',
  actionable = false,
  actions = [],
  onDismiss,
  className
}) => {
  const config = {
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      iconColor: 'text-red-500 dark:text-red-400',
      titleColor: 'text-red-800 dark:text-red-300',
      messageColor: 'text-red-700'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      iconColor: 'text-yellow-500 dark:text-yellow-400',
      titleColor: 'text-yellow-800 dark:text-yellow-300',
      messageColor: 'text-yellow-700'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-500 dark:text-blue-400',
      titleColor: 'text-blue-800 dark:text-blue-300',
      messageColor: 'text-blue-700'
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      iconColor: 'text-green-500 dark:text-green-400',
      titleColor: 'text-green-800 dark:text-green-300',
      messageColor: 'text-green-700'
    }
  }

  const { icon: Icon, bgColor, borderColor, iconColor, titleColor, messageColor } = config[type]

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        bgColor,
        borderColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', iconColor)} />
        
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={cn('text-sm font-semibold mb-1', titleColor)}>
              {title}
            </h3>
          )}
          
          <p className={cn('text-sm', messageColor)}>
            {message}
          </p>

          {actionable && actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

interface ValidationErrorProps {
  errors: Record<string, string[]>
  className?: string
}

/**
 * Validation error display for forms
 */
export const ValidationError: React.FC<ValidationErrorProps> = ({
  errors,
  className
}) => {
  const { t } = useTranslations()
  const errorCount = Object.keys(errors).length

  if (errorCount === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      <ErrorMessage
        type="error"
        title={errorCount === 1 ? t('form.validation.title', { count: errorCount }) : t('form.validation.titlePlural', { count: errorCount })}
        message={t('form.validation.correctIssues')}
      />
      
      <ul className="space-y-1 ml-8">
        {Object.entries(errors).map(([field, fieldErrors]) =>
          fieldErrors.map((error, index) => (
            <li key={`${field}-${index}`} className="text-sm text-red-700">
              <strong className="font-medium capitalize">{field.replace(/_/g, ' ')}:</strong> {error}
            </li>
          ))
        )}
      </ul>
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

/**
 * Empty state component with guidance
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className
}) => {
  return (
    <div className={cn('text-center py-12', className)}>
      {icon && (
        <div className="flex justify-center mb-4 text-gray-400 dark:text-slate-500">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
        {description}
      </p>
      
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default ErrorMessage
