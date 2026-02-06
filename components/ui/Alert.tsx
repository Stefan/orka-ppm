/**
 * Alert Component
 * 
 * A professional alert component for notifications and messages.
 */

import React from 'react'
import { cn } from '@/lib/design-system'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'

type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'default' | 'destructive'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  className?: string
  dismissible?: boolean
  onDismiss?: () => void
}

const alertVariants: Record<AlertVariant, { bg: string; border: string; icon: string; title: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500 dark:text-blue-400',
    title: 'text-blue-800 dark:text-blue-300',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    icon: 'text-green-500 dark:text-green-400',
    title: 'text-green-800 dark:text-green-300',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500 dark:text-yellow-400',
    title: 'text-yellow-800 dark:text-yellow-300',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500 dark:text-red-400',
    title: 'text-red-800 dark:text-red-300',
  },
  default: {
    bg: 'bg-gray-50 dark:bg-slate-800/50',
    border: 'border-gray-200 dark:border-slate-700',
    icon: 'text-gray-500 dark:text-slate-400',
    title: 'text-gray-800 dark:text-slate-200',
  },
  destructive: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500 dark:text-red-400',
    title: 'text-red-800 dark:text-red-300',
  },
}

const alertIcons: Record<AlertVariant, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  default: Info,
  destructive: XCircle,
}

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  dismissible = false,
  onDismiss,
}: AlertProps) {
  const styles = alertVariants[variant]
  const Icon = alertIcons[variant]

  return (
    <div
      role="alert"
      className={cn(
        'relative rounded-lg border p-4',
        styles.bg,
        styles.border,
        className
      )}
    >
      <div className="flex gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
        <div className="flex-1 min-w-0">
          {title && (
            <h5 className={cn('font-medium mb-1', styles.title)}>
              {title}
            </h5>
          )}
          <div className="text-sm text-gray-700 dark:text-slate-300">
            {children}
          </div>
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-slate-400" />
          </button>
        )}
      </div>
    </div>
  )
}

export const AlertTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h5 className={cn('font-medium mb-1', className)}>{children}</h5>
)

export const AlertDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('text-sm', className)}>{children}</div>
)

export default Alert
