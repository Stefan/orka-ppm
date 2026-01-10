import React from 'react'
import { cn, responsive } from '@/lib/design-system'
import type { GridProps, ResponsiveValue } from '@/types'

/**
 * AdaptiveGrid - Molecule component for intelligent grid system
 * Mobile-first grid with adaptive column management
 */
export const AdaptiveGrid: React.FC<GridProps> = ({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 'md',
  alignItems = 'stretch',
  justifyContent = 'start',
  className,
  ...props
}) => {
  const getColumnClasses = (cols: ResponsiveValue<number>) => {
    const classes = [`grid-cols-${cols.mobile}`]
    if (cols.tablet) classes.push(`md:grid-cols-${cols.tablet}`)
    if (cols.desktop) classes.push(`lg:grid-cols-${cols.desktop}`)
    if (cols.wide) classes.push(`xl:grid-cols-${cols.wide}`)
    return classes.join(' ')
  }

  const gapClasses = {
    xs: 'gap-1',
    sm: 'gap-2',
    md: 'gap-4 md:gap-6',
    lg: 'gap-6 md:gap-8',
    xl: 'gap-8 md:gap-10',
    '2xl': 'gap-10 md:gap-12',
    '3xl': 'gap-12 md:gap-16',
    '4xl': 'gap-16 md:gap-20',
    '5xl': 'gap-20 md:gap-24',
  }

  const alignItemsClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }

  const justifyContentClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  }

  return (
    <div
      className={cn(
        'grid',
        getColumnClasses(columns),
        gapClasses[gap],
        alignItemsClasses[alignItems],
        justifyContentClasses[justifyContent],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export default AdaptiveGrid