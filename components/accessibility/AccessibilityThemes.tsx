'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { useLocalStorage } from '../../hooks/useLocalStorage'

interface AccessibilitySettings {
  highContrast: boolean
  reducedMotion: boolean
  fontSize: 'small' | 'medium' | 'large' | 'extra-large'
  theme: 'light' | 'dark' | 'high-contrast-light' | 'high-contrast-dark'
  focusIndicators: 'default' | 'enhanced' | 'high-visibility'
  colorBlindnessSupport: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia'
}

interface AccessibilityContextType {
  settings: AccessibilitySettings
  updateSettings: (updates: Partial<AccessibilitySettings>) => void
  resetSettings: () => void
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  fontSize: 'medium',
  theme: 'light',
  focusIndicators: 'default',
  colorBlindnessSupport: 'none'
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return context
}

interface AccessibilityProviderProps {
  children: React.ReactNode
}

export function AccessibilityProvider({ children }: AccessibilityProviderProps) {
  const [settings, setSettings] = useLocalStorage<AccessibilitySettings>(
    'accessibility-settings',
    defaultSettings
  )

  // Detect system preferences - only run once on mount
  useEffect(() => {
    // Detect prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const contrastQuery = window.matchMedia('(prefers-contrast: high)')
    const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    // Set up event listeners for system preference changes
    const handleReducedMotionChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ ...prev, reducedMotion: e.matches }))
    }

    const handleContrastChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ ...prev, highContrast: e.matches }))
    }

    const handleColorSchemeChange = (e: MediaQueryListEvent) => {
      setSettings(prev => ({ 
        ...prev, 
        theme: e.matches ? 'dark' : 'light' 
      }))
    }

    mediaQuery.addEventListener('change', handleReducedMotionChange)
    contrastQuery.addEventListener('change', handleContrastChange)
    darkQuery.addEventListener('change', handleColorSchemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleReducedMotionChange)
      contrastQuery.removeEventListener('change', handleContrastChange)
      darkQuery.removeEventListener('change', handleColorSchemeChange)
    }
  }, [setSettings]) // Only depend on setSettings function

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement

    // Apply theme
    root.setAttribute('data-theme', settings.theme)
    
    // Apply font size
    root.setAttribute('data-font-size', settings.fontSize)
    
    // Apply high contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }
    
    // Apply reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion')
    } else {
      root.classList.remove('reduced-motion')
    }
    
    // Apply focus indicators
    root.setAttribute('data-focus-style', settings.focusIndicators)
    
    // Apply color blindness support
    root.setAttribute('data-colorblind-support', settings.colorBlindnessSupport)

    // Update CSS custom properties
    const fontSizeMap = {
      'small': '14px',
      'medium': '16px',
      'large': '18px',
      'extra-large': '20px'
    }
    
    root.style.setProperty('--base-font-size', fontSizeMap[settings.fontSize])
  }, [settings])

  const updateSettings = (updates: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }))
    
    // Announce changes to screen readers
    if ((window as any).announceToScreenReader) {
      const changes = Object.entries(updates).map(([key, value]) => {
        return `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${value ? 'enabled' : 'disabled'}`
      }).join(', ')
      
      ;(window as any).announceToScreenReader(
        `Accessibility settings updated: ${changes}`,
        'polite'
      )
    }
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
    if ((window as any).announceToScreenReader) {
      ;(window as any).announceToScreenReader(
        'Accessibility settings reset to defaults',
        'polite'
      )
    }
  }

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

/**
 * AccessibilitySettingsPanel component for managing accessibility preferences
 */
export function AccessibilitySettingsPanel({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean
  onClose: () => void 
}) {
  const { settings, updateSettings, resetSettings } = useAccessibility()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-labelledby="accessibility-title"
        aria-describedby="accessibility-description"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id="accessibility-title" className="text-xl font-semibold text-gray-900">
              Accessibility Settings
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close accessibility settings"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div id="accessibility-description" className="text-sm text-gray-600 mb-6">
            Customize the interface to meet your accessibility needs
          </div>

          <div className="space-y-6">
            {/* Theme Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Theme
              </label>
              <select
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as any })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="high-contrast-light">High Contrast Light</option>
                <option value="high-contrast-dark">High Contrast Dark</option>
              </select>
            </div>

            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Font Size
              </label>
              <select
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: e.target.value as any })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="extra-large">Extra Large</option>
              </select>
            </div>

            {/* High Contrast Toggle */}
            <div className="flex items-center">
              <input
                id="high-contrast"
                type="checkbox"
                checked={settings.highContrast}
                onChange={(e) => updateSettings({ highContrast: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="high-contrast" className="ml-3 block text-sm text-gray-700">
                Enable high contrast mode
              </label>
            </div>

            {/* Reduced Motion Toggle */}
            <div className="flex items-center">
              <input
                id="reduced-motion"
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => updateSettings({ reducedMotion: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="reduced-motion" className="ml-3 block text-sm text-gray-700">
                Reduce motion and animations
              </label>
            </div>

            {/* Focus Indicators */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Focus Indicators
              </label>
              <select
                value={settings.focusIndicators}
                onChange={(e) => updateSettings({ focusIndicators: e.target.value as any })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="default">Default</option>
                <option value="enhanced">Enhanced</option>
                <option value="high-visibility">High Visibility</option>
              </select>
            </div>

            {/* Color Blindness Support */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color Blindness Support
              </label>
              <select
                value={settings.colorBlindnessSupport}
                onChange={(e) => updateSettings({ colorBlindnessSupport: e.target.value as any })}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 min-h-[44px]"
              >
                <option value="none">None</option>
                <option value="deuteranopia">Deuteranopia (Green-blind)</option>
                <option value="protanopia">Protanopia (Red-blind)</option>
                <option value="tritanopia">Tritanopia (Blue-blind)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between mt-8">
            <button
              onClick={resetSettings}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 min-h-[44px]"
            >
              Reset to Defaults
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 min-h-[44px]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}