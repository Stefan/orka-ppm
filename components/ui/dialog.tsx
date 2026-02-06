/**
 * Dialog/Modal Component
 *
 * A professional modal dialog with smooth animations and proper accessibility.
 */

import React, { useEffect } from 'react'
import { cn } from '@/lib/design-system'
import { X } from 'lucide-react'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50">
        {children}
      </div>
    </div>
  )
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  showClose?: boolean
  onClose?: () => void
}

export function DialogContent({
  children,
  className,
  showClose = true,
  onClose,
  ...props
}: DialogContentProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-800 rounded-xl shadow-2xl',
        'w-full max-w-lg',
        'max-h-[90vh] overflow-auto',
        className
      )}
      {...props}
    >
      {showClose && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 dark:bg-slate-700 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
        </button>
      )}
      {children}
    </div>
  )
}

export function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 pt-6 pb-4', className)} {...props}>
      {children}
    </div>
  )
}

export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-lg font-semibold text-gray-900 dark:text-slate-100', className)} {...props}>
      {children}
    </h2>
  )
}

export function DialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-sm text-gray-600 dark:text-slate-400 mt-1', className)} {...props}>
      {children}
    </p>
  )
}

export function DialogBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-6 py-4 bg-gray-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end gap-3', className)} {...props}>
      {children}
    </div>
  )
}

export default Dialog
