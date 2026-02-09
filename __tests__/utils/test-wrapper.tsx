/**
 * Test Wrapper Component
 *
 * Provides all necessary context providers for testing components
 * that depend on Auth, HelpChat, Language, I18n, and other contexts.
 *
 * For components that use useI18n() or useTranslations() (from lib/i18n/context),
 * use renderWithI18n(ui) or wrap with <I18nTestWrapper> so they run inside I18nProvider.
 */

import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n/context'
import { mockData } from '../fixtures/mockData'

/** Wraps children with I18nProvider so useI18n/useTranslations work. Use when a component needs t() or locale. */
export function I18nTestWrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>
}

/**
 * Renders ui with I18nProvider as wrapper. Use for any test whose component (or a child) calls useI18n() or useTranslations().
 *
 * Usage: replace `render(...)` with `renderWithI18n(...)` and import from this file instead of @testing-library/react.
 * @example
 *   import { renderWithI18n, screen, fireEvent } from '@/__tests__/utils/test-wrapper'
 *   renderWithI18n(<PMRChart type="budget-variance" data={data} title="Test" />)
 *   // Or with destructuring: const { container } = renderWithI18n(<MyComponent />)
 */
export function renderWithI18n(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, {
    ...options,
    wrapper: ({ children }) => <I18nTestWrapper>{children}</I18nTestWrapper>,
  })
}

// Mock context values
interface MockContextValues {
  auth?: {
    user?: any
    session?: any
    loading?: boolean
    error?: any
  }
  helpChat?: {
    isOpen?: boolean
    messages?: any[]
    isLoading?: boolean
  }
  language?: {
    currentLanguage?: string
    supportedLanguages?: any[]
  }
}

// Create a custom render function that wraps components with providers
export function renderWithProviders(
  ui: React.ReactElement,
  {
    mockValues = {},
    ...renderOptions
  }: RenderOptions & { mockValues?: MockContextValues } = {}
) {
  // Mock Auth Context
  const mockAuth = {
    user: mockValues.auth?.user || mockData.user,
    session: mockValues.auth?.session || mockData.session,
    loading: mockValues.auth?.loading || false,
    error: mockValues.auth?.error || null,
    clearSession: jest.fn(),
  }

  // Mock HelpChat Context
  const mockHelpChat = {
    state: {
      isOpen: mockValues.helpChat?.isOpen || false,
      messages: mockValues.helpChat?.messages || [],
      isLoading: mockValues.helpChat?.isLoading || false,
      currentContext: {
        route: '/',
        pageTitle: 'Dashboard',
        userRole: 'user',
      },
      userPreferences: {
        language: 'en',
        proactiveTips: true,
        chatPosition: 'right',
        soundEnabled: false,
        tipFrequency: 'medium',
        theme: 'auto',
      },
      sessionId: 'test-session-123',
      proactiveTipsEnabled: true,
      language: 'en',
      isTyping: false,
      error: null,
    },
    toggleChat: jest.fn(),
    sendMessage: jest.fn(),
    clearMessages: jest.fn(),
    updateContext: jest.fn(),
    updatePreferences: jest.fn(),
    dismissTip: jest.fn(),
    submitFeedback: jest.fn(),
    isContextRelevant: jest.fn(() => true),
    getProactiveTips: jest.fn(() => Promise.resolve([])),
    exportChatHistory: jest.fn(() => '[]'),
    translateMessage: jest.fn((content) => Promise.resolve(content)),
    detectMessageLanguage: jest.fn(() => Promise.resolve(null)),
    formatMessageDate: jest.fn((date) => date.toLocaleDateString()),
    formatMessageNumber: jest.fn((num) => num.toLocaleString()),
    getLanguageName: jest.fn((code) => code),
    currentLanguage: 'en',
  }

  // Mock Language Context
  const mockLanguage = {
    currentLanguage: mockValues.language?.currentLanguage || 'en',
    supportedLanguages: mockValues.language?.supportedLanguages || [
      { code: 'en', name: 'English', native_name: 'English', formal_tone: false },
      { code: 'de', name: 'German', native_name: 'Deutsch', formal_tone: true },
      { code: 'fr', name: 'French', native_name: 'Français', formal_tone: true },
    ],
    isLoading: false,
    error: null,
    setLanguage: jest.fn(() => Promise.resolve(true)),
    getUserLanguagePreference: jest.fn(() => Promise.resolve('en')),
    getSupportedLanguages: jest.fn(() => Promise.resolve([])),
    detectLanguage: jest.fn(() => Promise.resolve(null)),
    translateContent: jest.fn((content) => Promise.resolve({
      original_content: content,
      translated_content: content,
      source_language: 'en',
      target_language: 'en',
      quality_score: 1.0,
      translation_time_ms: 0,
      cached: false,
      confidence: 1.0,
    })),
    clearTranslationCache: jest.fn(() => Promise.resolve(true)),
    getLanguageName: jest.fn((code) => code),
    isRTL: jest.fn(() => false),
    formatDate: jest.fn((date) => date.toLocaleDateString()),
    formatNumber: jest.fn((num) => num.toLocaleString()),
  }

  // Wrapper component that provides all contexts (including I18n for useTranslations/useI18n)
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <I18nTestWrapper>{children}</I18nTestWrapper>
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    mockAuth,
    mockHelpChat,
    mockLanguage,
  }
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'

// Export the custom render as default
export { renderWithProviders as render }
