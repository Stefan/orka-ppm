/**
 * Unit Tests for Design System Utilities
 * Tests cn, getResponsiveClasses, getVariantClasses, darkMode, motionSafe, motionReduce
 */

import { describe, it, expect } from '@jest/globals'
import {
  cn,
  colors,
  spacing,
  typography,
  breakpoints,
  shadows,
  borderRadius,
  variants,
  getResponsiveClasses,
  getVariantClasses,
  darkMode,
  motionSafe,
  motionReduce
} from '../design-system'

describe('cn function', () => {
  it('should combine multiple classes correctly', () => {
    const result = cn('text-red-500', 'bg-blue-500', 'p-4')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('p-4')
  })

  it('should resolve Tailwind conflicts with later classes overriding earlier ones', () => {
    // px-4 should override px-2
    const result1 = cn('px-2', 'px-4')
    expect(result1).toBe('px-4')
    expect(result1).not.toContain('px-2')

    // py-8 should override py-4
    const result2 = cn('py-4', 'py-8')
    expect(result2).toBe('py-8')
    expect(result2).not.toContain('py-4')

    // text-lg should override text-sm
    const result3 = cn('text-sm', 'text-lg')
    expect(result3).toBe('text-lg')
    expect(result3).not.toContain('text-sm')

    // bg-red-500 should override bg-blue-500
    const result4 = cn('bg-blue-500', 'bg-red-500')
    expect(result4).toBe('bg-red-500')
    expect(result4).not.toContain('bg-blue-500')
  })

  it('should handle conditional classes correctly', () => {
    const isActive = true
    const isDisabled = false

    const result = cn(
      'base-class',
      isActive && 'active-class',
      isDisabled && 'disabled-class',
      !isDisabled && 'enabled-class'
    )

    expect(result).toContain('base-class')
    expect(result).toContain('active-class')
    expect(result).toContain('enabled-class')
    expect(result).not.toContain('disabled-class')
  })

  it('should handle undefined and null values', () => {
    const result = cn('text-red-500', undefined, null, 'bg-blue-500')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
  })

  it('should handle empty strings', () => {
    const result = cn('text-red-500', '', 'bg-blue-500')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
  })

  it('should handle arrays of classes', () => {
    const result = cn(['text-red-500', 'bg-blue-500'], 'p-4')
    expect(result).toContain('text-red-500')
    expect(result).toContain('bg-blue-500')
    expect(result).toContain('p-4')
  })

  it('should handle objects with boolean values', () => {
    const result = cn({
      'text-red-500': true,
      'bg-blue-500': false,
      'p-4': true
    })
    expect(result).toContain('text-red-500')
    expect(result).toContain('p-4')
    expect(result).not.toContain('bg-blue-500')
  })

  it('should combine multiple types of inputs', () => {
    const isActive = true
    const result = cn(
      'base-class',
      ['array-class-1', 'array-class-2'],
      { 'object-class': true, 'hidden-class': false },
      isActive && 'conditional-class',
      'final-class'
    )

    expect(result).toContain('base-class')
    expect(result).toContain('array-class-1')
    expect(result).toContain('array-class-2')
    expect(result).toContain('object-class')
    expect(result).toContain('conditional-class')
    expect(result).toContain('final-class')
    expect(result).not.toContain('hidden-class')
  })

  it('should resolve complex Tailwind conflicts with multiple properties', () => {
    const result = cn(
      'px-2 py-4 text-sm bg-blue-500',
      'px-4 text-lg'
    )
    
    // px-4 should override px-2
    expect(result).toContain('px-4')
    expect(result).not.toContain('px-2')
    
    // text-lg should override text-sm
    expect(result).toContain('text-lg')
    expect(result).not.toContain('text-sm')
    
    // py-4 and bg-blue-500 should remain
    expect(result).toContain('py-4')
    expect(result).toContain('bg-blue-500')
  })

  it('should handle responsive variants correctly', () => {
    const result = cn('text-sm md:text-lg lg:text-xl')
    expect(result).toContain('text-sm')
    expect(result).toContain('md:text-lg')
    expect(result).toContain('lg:text-xl')
  })

  it('should resolve conflicts in responsive variants', () => {
    const result = cn('md:px-2', 'md:px-4')
    expect(result).toBe('md:px-4')
    expect(result).not.toContain('md:px-2')
  })
})

describe('design system constants', () => {
  it('colors has primary, secondary, success, warning, error', () => {
    expect(colors.primary[500]).toBe('#3b82f6')
    expect(colors.secondary[500]).toBe('#64748b')
    expect(colors.success[500]).toBe('#22c55e')
    expect(colors.warning[500]).toBe('#f59e0b')
    expect(colors.error[500]).toBe('#ef4444')
  })
  it('spacing has numeric keys', () => {
    expect(spacing[0]).toBe('0px')
    expect(spacing[4]).toBe('1rem')
  })
  it('typography has fontSize and fontWeight', () => {
    expect(typography.fontSize.sm).toEqual(['0.875rem', { lineHeight: '1.25rem' }])
    expect(typography.fontWeight.medium).toBe('500')
  })
  it('breakpoints has sm, md, lg', () => {
    expect(breakpoints.sm).toBe('640px')
    expect(breakpoints.lg).toBe('1024px')
  })
  it('shadows and borderRadius are defined', () => {
    expect(shadows.sm).toContain('rgb')
    expect(borderRadius.lg).toBe('0.5rem')
  })
  it('variants has button, input, badge', () => {
    expect(variants.button.primary).toContain('bg-primary')
    expect(variants.input.error).toContain('border-error')
    expect(variants.badge.success).toContain('bg-success')
  })
})

describe('getResponsiveClasses', () => {
  it('returns base when no breakpoints', () => {
    expect(getResponsiveClasses('p-4')).toBe('p-4')
  })
  it('appends sm/md/lg prefixed classes', () => {
    const r = getResponsiveClasses('p-2', 'p-4', 'p-6', 'p-8')
    expect(r).toContain('p-2')
    expect(r).toContain('sm:p-4')
    expect(r).toContain('md:p-6')
    expect(r).toContain('lg:p-8')
  })
  it('handles 2xl', () => {
    const r = getResponsiveClasses('text-sm', undefined, undefined, undefined, undefined, 'text-2xl')
    expect(r).toContain('2xl:text-2xl')
  })
})

describe('getVariantClasses', () => {
  it('returns variant class for button', () => {
    const r = getVariantClasses('button', 'primary')
    expect(r).toContain('bg-primary')
  })
  it('adds size and state when provided', () => {
    const r = getVariantClasses('button', 'secondary', 'lg', 'disabled')
    expect(r).toContain('button-lg')
    expect(r).toContain('button-disabled')
  })
  it('returns empty for unknown variant', () => {
    const r = getVariantClasses('button', 'unknown')
    expect(r).toBe('')
  })
})

describe('darkMode', () => {
  it('returns light and dark class', () => {
    expect(darkMode('bg-white', 'bg-black')).toBe('bg-white dark:bg-black')
  })
})

describe('motionSafe', () => {
  it('prefixes with motion-safe', () => {
    expect(motionSafe('animate-spin')).toBe('motion-safe:animate-spin')
  })
})

describe('motionReduce', () => {
  it('prefixes with motion-reduce', () => {
    expect(motionReduce('transition-none')).toBe('motion-reduce:transition-none')
  })
})
