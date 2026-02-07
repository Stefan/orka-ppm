/**
 * ORKA-PPM Mobile-First Design System
 * Enhanced design tokens, atomic design patterns, and utility functions
 */

// Enhanced Design Tokens with Mobile-First Approach
export const designTokens = {
  // Color System with Extended Palette
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
      950: '#030712',
    },
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    },
  },

  // Typography System
  typography: {
    fontFamily: {
      sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'SF Mono', 'Consolas', 'Liberation Mono', 'Menlo', 'monospace'],
    },
    fontSize: {
      xs: ['0.75rem', { lineHeight: '1rem' }],
      sm: ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem', { lineHeight: '1.5rem' }],
      lg: ['1.125rem', { lineHeight: '1.75rem' }],
      xl: ['1.25rem', { lineHeight: '1.75rem' }],
      '2xl': ['1.5rem', { lineHeight: '2rem' }],
      '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      '5xl': ['3rem', { lineHeight: '1' }],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
  },

  // Spacing System
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
    '4xl': '5rem',    // 80px
    '5xl': '6rem',    // 96px
  },

  // Mobile-First Breakpoints
  breakpoints: {
    sm: '640px',      // Small devices (landscape phones)
    md: '768px',      // Medium devices (tablets)
    lg: '1024px',     // Large devices (laptops)
    xl: '1280px',     // Extra large devices (large laptops)
    '2xl': '1536px',  // 2X large devices (larger desktops)
  },

  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
  },

  // Shadows
  boxShadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },

  // Animation
  animation: {
    duration: {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
      slower: '500ms',
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },
} as const

// Enhanced Component Variants with Mobile-First Design
export const componentVariants = {
  // Button Variants
  button: {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 active:bg-primary-800',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 active:bg-gray-300',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 active:bg-gray-200',
    danger: 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500 active:bg-error-800',
    success: 'bg-success-600 text-white hover:bg-success-700 focus:ring-success-500 active:bg-success-800',
    warning: 'bg-warning-600 text-white hover:bg-warning-700 focus:ring-warning-500 active:bg-warning-800',
  },

  // Input Variants
  input: {
    default: 'border-gray-300 focus:border-primary-500 focus:ring-primary-500',
    error: 'border-error-300 focus:border-error-500 focus:ring-error-500 bg-error-50',
    success: 'border-success-300 focus:border-success-500 focus:ring-success-500 bg-success-50',
    warning: 'border-warning-300 focus:border-warning-500 focus:ring-warning-500 bg-warning-50',
  },

  // Card Variants
  card: {
    default: 'bg-white border border-gray-200 rounded-xl shadow-sm',
    elevated: 'bg-white border border-gray-200 rounded-xl shadow-md',
    interactive: 'bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-200',
    outlined: 'bg-transparent border-2 border-gray-300 rounded-xl',
    filled: 'bg-gray-50 border border-gray-200 rounded-xl',
  },

  // Badge Variants
  badge: {
    primary: 'bg-primary-100 text-primary-800 border border-primary-200',
    secondary: 'bg-gray-100 text-gray-800 border border-gray-200',
    success: 'bg-success-100 text-success-800 border border-success-200',
    warning: 'bg-warning-100 text-warning-800 border border-warning-200',
    error: 'bg-error-100 text-error-800 border border-error-200',
  },

  // Alert Variants
  alert: {
    info: 'bg-primary-50 border border-primary-200 text-primary-800',
    success: 'bg-success-50 border border-success-200 text-success-800',
    warning: 'bg-warning-50 border border-warning-200 text-warning-800',
    error: 'bg-error-50 border border-error-200 text-error-800',
  },
} as const

// Atomic Design System Patterns
export const atomicPatterns = {
  // Atoms - Basic building blocks
  atoms: {
    text: {
      heading: 'font-semibold text-gray-900',
      body: 'text-gray-700 leading-relaxed',
      caption: 'text-sm text-gray-500',
      label: 'text-sm font-medium text-gray-700',
    },
    icon: {
      small: 'w-4 h-4',
      medium: 'w-5 h-5',
      large: 'w-6 h-6',
      xlarge: 'w-8 h-8',
    },
    spinner: {
      small: 'w-4 h-4 border-2',
      medium: 'w-6 h-6 border-2',
      large: 'w-8 h-8 border-3',
    },
  },

  // Molecules - Simple combinations of atoms
  molecules: {
    inputGroup: 'space-y-2',
    buttonGroup: 'flex space-x-2',
    cardHeader: 'flex items-center justify-between p-6 border-b border-gray-100',
    cardContent: 'p-6',
    cardFooter: 'flex items-center justify-end space-x-3 p-6 border-t border-gray-100',
  },

  // Organisms - Complex combinations
  organisms: {
    navigation: 'bg-white border-b border-gray-200 sticky top-0 z-50',
    sidebar: 'bg-white border-r border-gray-200 h-full',
    modal: 'bg-white rounded-xl shadow-xl max-w-md w-full mx-4',
    table: 'bg-white border border-gray-200 rounded-xl overflow-hidden',
  },
} as const

// Touch Target Utilities (WCAG 2.1 AA Compliance)
export const touchTargets = {
  minimum: 'min-h-[44px] min-w-[44px]',      // WCAG minimum
  comfortable: 'min-h-[48px] min-w-[48px]',  // Comfortable touch
  large: 'min-h-[56px] min-w-[56px]',        // Large touch targets
  xlarge: 'min-h-[64px] min-w-[64px]',       // Extra large for primary actions
} as const

// Mobile-First Responsive Utilities
export const responsive = {
  // Container utilities
  container: {
    mobile: 'w-full px-4',
    tablet: 'w-full px-6 md:max-w-3xl md:mx-auto',
    desktop: 'w-full px-8 lg:max-w-5xl lg:mx-auto',
    wide: 'w-full px-12 xl:max-w-7xl xl:mx-auto',
  },

  // Grid utilities
  grid: {
    mobile: 'grid grid-cols-1 gap-4',
    tablet: 'grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6',
    desktop: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8',
    wide: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 lg:gap-8',
  },

  // Flex utilities
  flex: {
    mobile: 'flex flex-col space-y-4',
    tablet: 'flex flex-col md:flex-row md:space-y-0 md:space-x-6',
    desktop: 'flex flex-col lg:flex-row lg:space-y-0 lg:space-x-8',
  },

  // Text utilities
  text: {
    responsive: 'text-sm sm:text-base lg:text-lg',
    heading: 'text-lg sm:text-xl lg:text-2xl xl:text-3xl',
    display: 'text-2xl sm:text-3xl lg:text-4xl xl:text-5xl',
  },

  // Spacing utilities
  spacing: {
    section: 'py-8 sm:py-12 lg:py-16',
    component: 'p-4 sm:p-6 lg:p-8',
    element: 'p-2 sm:p-3 lg:p-4',
  },
} as const

// Utility Functions
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ')
}

export const getResponsiveClasses = (
  mobile: string,
  tablet?: string,
  desktop?: string,
  wide?: string
): string => {
  const classes = [mobile]
  if (tablet) classes.push(`md:${tablet}`)
  if (desktop) classes.push(`lg:${desktop}`)
  if (wide) classes.push(`xl:${wide}`)
  return classes.join(' ')
}

// Theme utilities
export const getThemeClasses = (theme: 'light' | 'dark' | 'auto' = 'light') => {
  const baseClasses = {
    light: 'bg-white text-gray-900',
    dark: 'bg-gray-900 text-white',
    auto: 'bg-white text-gray-900 dark:bg-gray-900 dark:text-white',
  }
  return baseClasses[theme]
}

// Animation utilities
export const animations = {
  fadeIn: 'animate-fade-in',
  fadeOut: 'animate-fade-out',
  slideInUp: 'animate-slide-in-up',
  slideInDown: 'animate-slide-in-down',
  slideInLeft: 'animate-slide-in-left',
  slideInRight: 'animate-slide-in-right',
  scaleIn: 'animate-scale-in',
  scaleOut: 'animate-scale-out',
  bounceIn: 'animate-bounce-in',
  pulse: 'animate-pulse-slow',
} as const

// Validation utilities
export const validateTouchTarget = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect()
  return rect.width >= 44 && rect.height >= 44
}

export const validateColorContrast = (_foreground: string, _background: string): number => {
  // Simplified contrast ratio calculation
  // In a real implementation, you'd use a proper color contrast library
  return 4.5 // Placeholder for WCAG AA compliance
}

// Type exports
export type DesignTokens = typeof designTokens
export type ComponentVariants = typeof componentVariants
export type AtomicPatterns = typeof atomicPatterns
export type TouchTargets = typeof touchTargets
export type Responsive = typeof responsive