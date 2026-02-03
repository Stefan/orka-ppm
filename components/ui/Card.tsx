/**
 * Card Component
 * 
 * A professional card component with clean styling and proper shadows.
 */

import React from 'react'
import { cn } from '@/lib/design-system'
import type { ComponentSize, ShadowSize } from '@/types/components'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: ComponentSize
  shadow?: ShadowSize
  border?: boolean
  children: React.ReactNode
  className?: string
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode
  className?: string
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode
  className?: string
}

const cardPadding: Record<ComponentSize, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const cardShadow: Record<ShadowSize, string> = {
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
}

/**
 * Card Component - Clean, professional card with subtle shadow
 */
export function Card({ 
  padding = 'md', 
  shadow = 'sm',
  border = true,
  className,
  children,
  ...props 
}: CardProps) {
  return (
    <div
      className={cn(
        // Base styles - theme-aware
        'bg-white dark:bg-slate-800 rounded-xl',
        // Text color
        'text-gray-900 dark:text-slate-100',
        // Shadow
        cardShadow[shadow],
        // Border
        border && 'border border-gray-200 dark:border-slate-700',
        // Padding
        cardPadding[padding],
        // Transition for hover effects
        'transition-shadow duration-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * CardHeader - For card titles and descriptions
 */
export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div 
      className={cn(
        'pb-4 mb-4 border-b border-gray-200 dark:border-slate-700',
        className
      )} 
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * CardContent - Main content area
 */
export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div className={cn(className)} {...props}>
      {children}
    </div>
  )
}

/**
 * CardFooter - For actions and buttons
 */
export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div 
      className={cn(
        'pt-4 mt-4 border-t border-gray-100 dark:border-slate-700',
        className
      )} 
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * CardTitle - For card headings
 */
export function CardTitle({ className, children, ...props }: CardTitleProps) {
  return (
    <h3 
      className={cn(
        'text-lg font-semibold text-gray-900 dark:text-slate-100',
        className
      )} 
      {...props}
    >
      {children}
    </h3>
  )
}

/**
 * CardDescription - For card subtitles/descriptions
 */
export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p 
      className={cn(
        'text-sm text-gray-500 dark:text-slate-400 mt-1',
        className
      )} 
      {...props}
    >
      {children}
    </p>
  )
}

export default Card
