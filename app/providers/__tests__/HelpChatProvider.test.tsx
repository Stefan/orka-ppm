import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { HelpChatProvider, useHelpChat } from '../HelpChatProvider'

// Mock all dependencies to prevent infinite loops
jest.mock('../SupabaseAuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', role: 'user' },
    session: { access_token: 'test-token' }
  })
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/test',
    query: {},
    asPath: '/test',
  }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock('../../../contexts/PortfolioContext', () => ({
  usePortfolio: () => ({
    currentPortfolioId: null,
    currentPortfolio: null,
    setCurrentPortfolioId: jest.fn(),
    portfolios: [],
    setPortfolios: jest.fn(),
  }),
  PortfolioProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('../../../hooks/useLanguage', () => ({
  useLanguage: () => ({
    currentLanguage: 'en',
    setLanguage: jest.fn(() => Promise.resolve(true)),
    getUserLanguagePreference: jest.fn(() => Promise.resolve('en')),
    translateContent: jest.fn(() => Promise.resolve({ translated_content: 'translated' })),
    detectLanguage: jest.fn(() => Promise.resolve({ detected_language: 'en', confidence: 0.9 })),
    getLanguageName: jest.fn((code: string) => code === 'en' ? 'English' : code),
    formatDate: jest.fn((date: Date) => date.toLocaleDateString()),
    formatNumber: jest.fn((num: number) => num.toString()),
  })
}))

jest.mock('../../../lib/help-chat/api', () => ({
  helpChatAPI: {
    setAuthToken: jest.fn(),
    submitQuery: jest.fn(() => Promise.resolve({
      response: 'Test response',
      sessionId: 'test-session',
      sources: [],
      confidence: 0.9,
      responseTimeMs: 100
    })),
    dismissProactiveTip: jest.fn(() => Promise.resolve()),
    getProactiveTips: jest.fn(() => Promise.resolve({ tips: [] })),
  }
}))

jest.mock('../../../lib/help-chat-feedback-integration', () => ({
  helpChatFeedbackIntegration: {
    setAuthToken: jest.fn(),
    submitIntegratedFeedback: jest.fn(() => Promise.resolve({
      helpFeedbackSubmitted: true,
      bugReportSubmitted: false,
      featureRequestSubmitted: false,
      errors: []
    })),
  }
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Test component that uses the context
function TestComponent() {
  const context = useHelpChat()
  
  return (
    <div>
      <div data-testid="is-open">{context.state.isOpen.toString()}</div>
      <div data-testid="session-id">{context.state.sessionId}</div>
      <div data-testid="language">{context.state.language}</div>
      <div data-testid="current-route">{context.state.currentContext.route}</div>
      <div data-testid="page-title">{context.state.currentContext.pageTitle}</div>
      <div data-testid="user-role">{context.state.currentContext.userRole}</div>
      <div data-testid="proactive-tips">{context.state.proactiveTipsEnabled.toString()}</div>
      <div data-testid="message-count">{context.state.messages.length}</div>
      <button data-testid="toggle-chat" onClick={context.toggleChat}>
        Toggle Chat
      </button>
      <button 
        data-testid="send-message" 
        onClick={() => context.sendMessage('Test message')}
      >
        Send Message
      </button>
      <button 
        data-testid="clear-messages" 
        onClick={context.clearMessages}
      >
        Clear Messages
      </button>
      <button 
        data-testid="update-context" 
        onClick={() => context.updateContext({ pageTitle: 'Updated Page' })}
      >
        Update Context
      </button>
      <button 
        data-testid="update-preferences" 
        onClick={() => context.updatePreferences({ language: 'de' })}
      >
        Update Preferences
      </button>
      <button 
        data-testid="export-history" 
        onClick={() => {
          const history = context.exportChatHistory()
          const element = document.createElement('div')
          element.setAttribute('data-testid', 'exported-history')
          element.textContent = history
          document.body.appendChild(element)
        }}
      >
        Export History
      </button>
    </div>
  )
}

// Test component that uses context outside provider
function OutsideProviderComponent() {
  try {
    useHelpChat()
    return <div data-testid="no-error">No error</div>
  } catch (error) {
    return <div data-testid="error">{(error as Error).message}</div>
  }
}

describe('HelpChatProvider', () => {
  // Get references to the mocked functions
  const { helpChatAPI } = require('../../../lib/help-chat/api')
  const { helpChatFeedbackIntegration } = require('../../../lib/help-chat-feedback-integration')

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
    
    // Reset mock implementations
    helpChatAPI.submitQuery.mockResolvedValue({
      response: 'Test response',
      sessionId: 'test-session',
      sources: [],
      confidence: 0.9,
      responseTimeMs: 100
    })
    helpChatAPI.dismissProactiveTip.mockResolvedValue(undefined)
    helpChatAPI.getProactiveTips.mockResolvedValue({ tips: [] })
    helpChatFeedbackIntegration.submitIntegratedFeedback.mockResolvedValue({
      helpFeedbackSubmitted: true,
      bugReportSubmitted: false,
      featureRequestSubmitted: false,
      errors: []
    })
  })

  describe('Context Provider Error Handling', () => {
    it('throws error when useHelpChat is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<OutsideProviderComponent />)
      
      expect(screen.getByTestId('error')).toHaveTextContent('useHelpChat must be used within a HelpChatProvider')
      
      consoleSpy.mockRestore()
    })
  })

  describe('State Management - Requirement 1.1, 1.4', () => {
    it('provides initial state with default values', () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      expect(screen.getByTestId('is-open')).toHaveTextContent('false')
      expect(screen.getByTestId('language')).toHaveTextContent('en')
      expect(screen.getByTestId('proactive-tips')).toHaveTextContent('true')
      expect(screen.getByTestId('message-count')).toHaveTextContent('0')
    })

    it('toggles chat visibility', async () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      expect(screen.getByTestId('is-open')).toHaveTextContent('false')
      
      fireEvent.click(screen.getByTestId('toggle-chat'))
      
      await waitFor(() => {
        expect(screen.getByTestId('is-open')).toHaveTextContent('true')
      })
    })

    it('clears messages', async () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      // First send a message to have something to clear
      fireEvent.click(screen.getByTestId('send-message'))
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('1')
      })

      fireEvent.click(screen.getByTestId('clear-messages'))
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('0')
      })
    })

    it('updates context', async () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboards')
      
      fireEvent.click(screen.getByTestId('update-context'))
      
      await waitFor(() => {
        expect(screen.getByTestId('page-title')).toHaveTextContent('Updated Page')
      })
    })

    it('updates preferences', async () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      expect(screen.getByTestId('language')).toHaveTextContent('en')
      
      fireEvent.click(screen.getByTestId('update-preferences'))
      
      await waitFor(() => {
        expect(screen.getByTestId('language')).toHaveTextContent('de')
      })
    })

    it('exports chat history', async () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      fireEvent.click(screen.getByTestId('export-history'))
      
      await waitFor(() => {
        const exportedHistory = document.querySelector('[data-testid="exported-history"]')
        expect(exportedHistory).toBeInTheDocument()
        expect(exportedHistory?.textContent).toContain('[]') // Empty array for no messages
      })
    })
  })

  describe('Context Detection - Requirement 1.5', () => {
    it('detects page context from pathname', () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      expect(screen.getByTestId('current-route')).toHaveTextContent('/dashboards')
      expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboards')
      expect(screen.getByTestId('user-role')).toHaveTextContent('user')
    })
  })

  describe('Persistence - Requirement 1.4', () => {
    it('handles localStorage errors gracefully', () => {
      // Mock localStorage to throw error
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage error')
      })

      // Should not crash and should render successfully
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      expect(screen.getByTestId('language')).toHaveTextContent('en') // Default value
      expect(screen.getByTestId('proactive-tips')).toHaveTextContent('true') // Default value
    })

    it('loads preferences from localStorage when available', () => {
      const preferences = {
        language: 'de',
        proactiveTips: false,
        chatPosition: 'left',
        soundEnabled: true,
        tipFrequency: 'low',
        theme: 'dark'
      }

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'help-chat-preferences') {
          return JSON.stringify(preferences)
        }
        if (key === 'help-chat-session-id') {
          return 'existing-session-123'
        }
        return null
      })

      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      // Should load stored preferences
      expect(screen.getByTestId('language')).toHaveTextContent('de')
      expect(screen.getByTestId('proactive-tips')).toHaveTextContent('false')
      expect(localStorageMock.getItem).toHaveBeenCalledWith('help-chat-preferences')
      expect(localStorageMock.getItem).toHaveBeenCalledWith('help-chat-session-id')
    })

    it('generates new session when expired', () => {
      // Set expired session
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'help-chat-session-id') {
          return 'expired-session'
        }
        if (key === 'help-chat-last-active') {
          return expiredTime.toISOString()
        }
        return null
      })

      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      // Should generate new session ID (not the expired one)
      const sessionId = screen.getByTestId('session-id').textContent
      expect(sessionId).not.toBe('expired-session')
      expect(sessionId).toMatch(/^help-session-\d+-[a-z0-9]+$/)
    })

    it('saves preferences to localStorage when updated', async () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      fireEvent.click(screen.getByTestId('update-preferences'))
      
      // Wait for debounced save
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600))
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'help-chat-preferences',
        expect.stringContaining('"language":"de"')
      )
    })
  })

  describe('Message Handling', () => {
    it('sends messages and receives responses', async () => {
      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      fireEvent.click(screen.getByTestId('send-message'))
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('2') // User message + AI response
      })

      expect(helpChatAPI.submitQuery).toHaveBeenCalledWith({
        query: 'Test message',
        sessionId: expect.any(String),
        context: expect.objectContaining({
          route: '/dashboards',
          pageTitle: 'Dashboards',
          userRole: 'user'
        }),
        language: 'en',
        includeProactiveTips: true
      })
    })

    it('handles API errors gracefully', async () => {
      helpChatAPI.submitQuery.mockRejectedValueOnce(new Error('API Error'))

      render(
        <HelpChatProvider>
          <TestComponent />
        </HelpChatProvider>
      )

      fireEvent.click(screen.getByTestId('send-message'))
      
      await waitFor(() => {
        expect(screen.getByTestId('message-count')).toHaveTextContent('2') // User message + error message
      })
    })
  })
})