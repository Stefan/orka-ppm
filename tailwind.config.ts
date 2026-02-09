import type { Config } from 'tailwindcss'

// Theme-aware colors using CSS variables
const themeColors = {
  background: 'var(--background)',
  'background-secondary': 'var(--background-secondary)',
  'background-tertiary': 'var(--background-tertiary)',
  'background-elevated': 'var(--background-elevated)',
  foreground: 'var(--foreground)',
  'foreground-secondary': 'var(--foreground-secondary)',
  'foreground-muted': 'var(--foreground-muted)',
  border: 'var(--border)',
  'border-hover': 'var(--border-hover)',
  'border-focus': 'var(--border-focus)',
  'theme-primary': 'var(--primary)',
  'theme-primary-hover': 'var(--primary-hover)',
  'theme-primary-foreground': 'var(--primary-foreground)',
  card: 'var(--card)',
  'card-hover': 'var(--card-hover)',
  'input-background': 'var(--input-background)',
  'input-border': 'var(--input-border)',
  sidebar: 'var(--sidebar-background)',
  'sidebar-foreground': 'var(--sidebar-foreground)',
  'sidebar-hover': 'var(--sidebar-hover)',
  'sidebar-active': 'var(--sidebar-active)',
}

// Design System Tokens
const designTokens = {
  colors: {
    // Theme colors
    ...themeColors,
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
    },
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
    },
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    // Legacy colors for backwards compatibility
    secondary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    accent: {
      50: '#fefce8',
      100: '#fef9c3',
      200: '#fef08a',
      300: '#fde047',
      400: '#facc15',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
      800: '#854d0e',
      900: '#713f12',
      950: '#422006',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
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
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
    // Touch targets for mobile
    'touch-target': '44px',
    'touch-target-comfortable': '48px',
    'touch-target-large': '56px',
  },
  fontSize: {
    xs: ['12px', { lineHeight: '16px' }],
    sm: ['14px', { lineHeight: '20px' }],
    base: ['16px', { lineHeight: '24px' }],
    lg: ['18px', { lineHeight: '28px' }],
    xl: ['20px', { lineHeight: '28px' }],
    '2xl': ['24px', { lineHeight: '32px' }],
    '3xl': ['30px', { lineHeight: '36px' }],
    '4xl': ['36px', { lineHeight: '40px' }],
    '5xl': ['48px', { lineHeight: '1' }],
    '6xl': ['60px', { lineHeight: '1' }],
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  boxShadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    // Touch and focus shadows
    'touch': '0 2px 8px rgba(0, 0, 0, 0.1)',
    'touch-active': '0 1px 4px rgba(0, 0, 0, 0.2)',
    'focus-ring': '0 0 0 3px rgba(59, 130, 246, 0.3)',
    'error-ring': '0 0 0 3px rgba(239, 68, 68, 0.3)',
  },
  borderRadius: {
    none: '0',
    sm: '4px',
    DEFAULT: '6px',
    md: '8px',
    lg: '12px',
    full: '9999px',
    // Touch-friendly radii
    'touch': '8px',
    'touch-large': '12px',
  },
  screens: {
    mobile: '0px',
    tablet: '768px',
    desktop: '1024px',
  },
}

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './.storybook/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: designTokens.colors,
      spacing: designTokens.spacing,
      fontSize: designTokens.fontSize,
      fontWeight: designTokens.fontWeight,
      boxShadow: designTokens.boxShadow,
      borderRadius: designTokens.borderRadius,
      screens: designTokens.screens,
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      // Additional responsive breakpoints for backwards compatibility
      ...({
        xs: '475px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      } as Record<string, string>),
      touch: { 'raw': '(hover: none) and (pointer: coarse)' },
      'no-touch': { 'raw': '(hover: hover) and (pointer: fine)' },
      'reduced-motion': { 'raw': '(prefers-reduced-motion: reduce)' },
      'high-contrast': { 'raw': '(prefers-contrast: high)' },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'fade-out': 'fadeOut 0.2s ease-in-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'slide-in-down': 'slideInDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-gentle': 'bounceGentle 0.6s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        // All animations use only transform and opacity for GPU compositing
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateZ(0)' },
          '100%': { opacity: '1', transform: 'translateZ(0)' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateZ(0)' },
          '100%': { opacity: '0', transform: 'translateZ(0)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%) translateZ(0)', opacity: '0' },
          '100%': { transform: 'translateY(0) translateZ(0)', opacity: '1' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-100%) translateZ(0)', opacity: '0' },
          '100%': { transform: 'translateY(0) translateZ(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9) translateZ(0)', opacity: '0' },
          '100%': { transform: 'scale(1) translateZ(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0) translateZ(0)' },
          '50%': { transform: 'translateY(-10px) translateZ(0)' },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    function({ addUtilities, theme }: any) {
      const newUtilities = {
        '.touch-target': {
          minHeight: theme('spacing.touch-target'),
          minWidth: theme('spacing.touch-target'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        '.touch-target-comfortable': {
          minHeight: theme('spacing.touch-target-comfortable'),
          minWidth: theme('spacing.touch-target-comfortable'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        '.touch-target-large': {
          minHeight: theme('spacing.touch-target-large'),
          minWidth: theme('spacing.touch-target-large'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        '.focus-ring': {
          outline: 'none',
          boxShadow: theme('boxShadow.focus-ring'),
        },
        '.focus-ring-error': {
          outline: 'none',
          boxShadow: theme('boxShadow.error-ring'),
        },
        '.safe-area-inset-top': {
          paddingTop: 'env(safe-area-inset-top)',
        },
        '.safe-area-inset-bottom': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.safe-area-inset-left': {
          paddingLeft: 'env(safe-area-inset-left)',
        },
        '.safe-area-inset-right': {
          paddingRight: 'env(safe-area-inset-right)',
        },
        // Cross-browser vendor prefix utilities
        '.flex-webkit': {
          'display': 'flex'
        },
        '.transform-gpu': {
          '-webkit-transform': 'translateZ(0)',
          '-moz-transform': 'translateZ(0)',
          'transform': 'translateZ(0)'
        },
        '.scroll-smooth-all': {
          'scroll-behavior': 'smooth',
          '-webkit-scroll-behavior': 'smooth',
          '-moz-scroll-behavior': 'smooth'
        },
        '.flex-cross-browser': {
          'display': 'flex'
        },
        '.flex-direction-column-cross-browser': {
          '-webkit-box-orient': 'vertical',
          '-webkit-box-direction': 'normal',
          '-webkit-flex-direction': 'column',
          '-ms-flex-direction': 'column',
          'flex-direction': 'column'
        },
        '.flex-1-cross-browser': {
          '-webkit-box-flex': '1',
          '-webkit-flex': '1 1 0%',
          '-ms-flex': '1 1 0%',
          'flex': '1 1 0%'
        },
        '.grid-cross-browser': {
          'display': 'grid'
        },
        '.transform-3d': {
          '-webkit-transform': 'translate3d(0, 0, 0)',
          '-moz-transform': 'translate3d(0, 0, 0)',
          '-ms-transform': 'translate3d(0, 0, 0)',
          'transform': 'translate3d(0, 0, 0)'
        },
        '.backface-hidden': {
          '-webkit-backface-visibility': 'hidden',
          '-moz-backface-visibility': 'hidden',
          'backface-visibility': 'hidden'
        },
        '.transition-cross-browser': {
          '-webkit-transition': 'all 0.3s ease',
          '-moz-transition': 'all 0.3s ease',
          '-ms-transition': 'all 0.3s ease',
          'transition': 'all 0.3s ease'
        },
        '.user-select-none-cross-browser': {
          '-webkit-user-select': 'none',
          '-moz-user-select': 'none',
          '-ms-user-select': 'none',
          'user-select': 'none'
        },
        '.appearance-none-cross-browser': {
          '-webkit-appearance': 'none',
          '-moz-appearance': 'none',
          'appearance': 'none'
        },
        '.box-shadow-cross-browser': {
          '-webkit-box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          '-moz-box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        },
        '.border-radius-cross-browser': {
          '-webkit-border-radius': '0.375rem',
          '-moz-border-radius': '0.375rem',
          'border-radius': '0.375rem'
        },
        '.overflow-scrolling-touch': {
          '-webkit-overflow-scrolling': 'touch'
        },
        '.will-change-scroll': {
          'will-change': 'transform'
        },
        '.contain-layout': {
          'contain': 'layout style paint'
        }
      }
      addUtilities(newUtilities)
    },
  ],
}

export default config