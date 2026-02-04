/**
 * Unit tests for lib/utils/design-system.ts (getThemeClasses, validateTouchTarget, validateColorContrast, etc.)
 * @jest-environment jsdom
 */

import {
  getThemeClasses,
  validateTouchTarget,
  validateColorContrast,
  getResponsiveClasses,
  designTokens,
  responsive,
  animations,
} from '../design-system'

describe('lib/utils/design-system', () => {
  describe('getThemeClasses', () => {
    it('returns light classes by default', () => {
      expect(getThemeClasses()).toContain('bg-white')
      expect(getThemeClasses()).toContain('text-gray-900')
    })
    it('returns light theme classes', () => {
      expect(getThemeClasses('light')).toContain('bg-white')
    })
    it('returns dark theme classes', () => {
      expect(getThemeClasses('dark')).toContain('bg-gray-900')
      expect(getThemeClasses('dark')).toContain('text-white')
    })
    it('returns auto theme with dark variant', () => {
      const c = getThemeClasses('auto')
      expect(c).toContain('dark:bg-gray-900')
      expect(c).toContain('dark:text-white')
    })
  })

  describe('validateTouchTarget', () => {
    it('returns true when element is at least 44x44', () => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ width: 44, height: 44 }),
        writable: true,
      })
      expect(validateTouchTarget(el)).toBe(true)
    })
    it('returns false when element is too small', () => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'getBoundingClientRect', {
        value: () => ({ width: 40, height: 44 }),
        writable: true,
      })
      expect(validateTouchTarget(el)).toBe(false)
    })
  })

  describe('validateColorContrast', () => {
    it('returns a contrast ratio number', () => {
      const ratio = validateColorContrast('#000', '#fff')
      expect(typeof ratio).toBe('number')
      expect(ratio).toBe(4.5)
    })
  })

  describe('getResponsiveClasses', () => {
    it('returns mobile class when no breakpoints', () => {
      expect(getResponsiveClasses('p-4')).toBe('p-4')
    })
    it('appends md/lg/xl prefixed classes', () => {
      const r = getResponsiveClasses('p-2', 'p-4', 'p-6', 'p-8')
      expect(r).toContain('p-2')
      expect(r).toContain('md:p-4')
      expect(r).toContain('lg:p-6')
      expect(r).toContain('xl:p-8')
    })
  })

  describe('designTokens', () => {
    it('has colors, typography, spacing, breakpoints', () => {
      expect(designTokens.colors.primary[500]).toBeDefined()
      expect(designTokens.typography.fontSize.base).toBeDefined()
      expect(designTokens.spacing.md).toBe('1rem')
      expect(designTokens.breakpoints.md).toBe('768px')
    })
  })

  describe('responsive', () => {
    it('has container, grid, flex, text, spacing', () => {
      expect(responsive.container.mobile).toContain('px-4')
      expect(responsive.grid.mobile).toContain('grid')
      expect(responsive.flex.mobile).toContain('flex')
    })
  })

  describe('animations', () => {
    it('has fadeIn, slideInUp, scaleIn', () => {
      expect(animations.fadeIn).toContain('fade-in')
      expect(animations.slideInUp).toContain('slide-in')
      expect(animations.scaleIn).toContain('scale-in')
    })
  })
})
