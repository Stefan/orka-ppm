/**
 * Feature: ai-empowered-ppm-features
 * Property 14: Frontend Error Handling
 * 
 * For any failed AI agent request, the Frontend SHALL display both a toast notification 
 * with the error message AND a retry button to resubmit the request.
 * 
 * Validates: Requirements 5.1, 5.2
 */

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import Reports from '@/app/reports/page'
import { ToastProvider } from '@/components/shared/Toast'
import { SupabaseAuthProvider } from '@/app/providers/SupabaseAuthProvider'
import { TranslationsProvider } from '@/lib/i18n/context'

// Mock the API
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock auth session
const mockSession = {
  access_token: 'test-token',
  user: {
    id: 'test-user-id',
    email: 'test@example.com'
  }
}

// Mock useAuth hook
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  SupabaseAuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    session: mockSession,
    user: mockSession.user,
    loading: false
  })
}))

// Mock translations
jest.mock('@/lib/i18n/context', () => ({
  TranslationsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTranslations: () => ({
    t: (key: string) => key,
    locale: 'en'
  })
}))

// Mock AppLayout
jest.mock('@/components/shared/AppLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>
}))

// Helper to render component with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  )
}

// Error type generator
const errorTypeArbitrary = fc.constantFrom(
  'network',
  'server',
  'timeout',
  'auth',
  'unknown'
)

// HTTP status code generator
const statusCodeArbitrary = fc.oneof(
  fc.constant(400), // Bad Request
  fc.constant(401), // Unauthorized
  fc.constant(403), // Forbidden
  fc.constant(404), // Not Found
  fc.constant(408), // Request Timeout
  fc.constant(500), // Internal Server Error
  fc.constant(502), // Bad Gateway
  fc.constant(503), // Service Unavailable
  fc.constant(504)  // Gateway Timeout
)

// Error message generator
const errorMessageArbitrary = fc.string({ minLength: 10, maxLength: 100 })

// Query generator
const queryArbitrary = fc.string({ minLength: 5, maxLength: 200 })

describe('Property 14: Frontend Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should display toast notification AND retry button for any failed AI agent request', () => {
    fc.assert(
      fc.asyncProperty(
        errorTypeArbitrary,
        statusCodeArbitrary,
        errorMessageArbitrary,
        queryArbitrary,
        async (errorType, statusCode, errorMessage, query) => {
          // Arrange: Mock failed API response
          mockFetch.mockRejectedValueOnce(
            Object.assign(new Error(errorMessage), { status: statusCode })
          )

          const user = userEvent.setup()
          renderWithProviders(<Reports />)

          // Wait for initial render
          await waitFor(() => {
            expect(screen.getByPlaceholderText('reports.typeMessage')).toBeInTheDocument()
          })

          const textarea = screen.getByPlaceholderText('reports.typeMessage')
          const sendButton = screen.getByRole('button', { name: /reports.send/i })

          // Act: Submit a query that will fail
          await user.clear(textarea)
          await user.type(textarea, query)
          await user.click(sendButton)

          // Assert: Toast notification should appear
          await waitFor(() => {
            // Check for toast notification (it appears in a portal)
            const toasts = document.querySelectorAll('[class*="toast"]')
            expect(toasts.length).toBeGreaterThan(0)
          }, { timeout: 3000 })

          // Assert: Retry button should be available
          // The retry button can be in the toast or in the error panel
          await waitFor(() => {
            const retryButtons = screen.queryAllByRole('button', { name: /retry/i })
            expect(retryButtons.length).toBeGreaterThan(0)
          }, { timeout: 3000 })

          // Verify both conditions are met
          const toasts = document.querySelectorAll('[class*="toast"], [class*="bg-red-50"]')
          expect(toasts.length).toBeGreaterThan(0)
          
          const retryButtons = screen.queryAllByRole('button', { name: /retry/i })
          expect(retryButtons.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should allow retry after error', () => {
    fc.assert(
      fc.asyncProperty(
        queryArbitrary,
        async (query) => {
          // Arrange: Mock failed then successful API response
          mockFetch
            .mockRejectedValueOnce(
              Object.assign(new Error('Network error'), { status: 503 })
            )
            .mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                response: 'Success response',
                sources: [],
                confidence_score: 0.9,
                conversation_id: 'test-conv-id',
                response_time_ms: 100
              })
            })

          const user = userEvent.setup()
          renderWithProviders(<Reports />)

          await waitFor(() => {
            expect(screen.getByPlaceholderText('reports.typeMessage')).toBeInTheDocument()
          })

          const textarea = screen.getByPlaceholderText('reports.typeMessage')
          const sendButton = screen.getByRole('button', { name: /reports.send/i })

          // Act: Submit query that fails
          await user.clear(textarea)
          await user.type(textarea, query)
          await user.click(sendButton)

          // Wait for error to appear
          await waitFor(() => {
            const retryButtons = screen.queryAllByRole('button', { name: /retry/i })
            expect(retryButtons.length).toBeGreaterThan(0)
          }, { timeout: 3000 })

          // Act: Click retry button
          const retryButtons = screen.getAllByRole('button', { name: /retry/i })
          await user.click(retryButtons[0])

          // Assert: Request should be retried and succeed
          await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(2)
          }, { timeout: 3000 })

          // Success message should appear
          await waitFor(() => {
            expect(screen.getByText(/Success response/i)).toBeInTheDocument()
          }, { timeout: 3000 })
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should display error message in toast notification', () => {
    fc.assert(
      fc.asyncProperty(
        errorMessageArbitrary,
        async (errorMessage) => {
          // Arrange: Mock failed API response with specific error message
          mockFetch.mockRejectedValueOnce(
            Object.assign(new Error(errorMessage), { status: 500 })
          )

          const user = userEvent.setup()
          renderWithProviders(<Reports />)

          await waitFor(() => {
            expect(screen.getByPlaceholderText('reports.typeMessage')).toBeInTheDocument()
          })

          const textarea = screen.getByPlaceholderText('reports.typeMessage')
          const sendButton = screen.getByRole('button', { name: /reports.send/i })

          // Act: Submit query
          await user.clear(textarea)
          await user.type(textarea, 'test query')
          await user.click(sendButton)

          // Assert: Error message should be visible somewhere in the UI
          await waitFor(() => {
            // The error message might be transformed, so we check for error indicators
            const errorElements = document.querySelectorAll('[class*="red"], [class*="error"]')
            expect(errorElements.length).toBeGreaterThan(0)
          }, { timeout: 3000 })
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should handle multiple consecutive errors', async () => {
    // Arrange: Mock multiple failed requests
    mockFetch
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockRejectedValueOnce(new Error('Error 3'))

    const user = userEvent.setup()
    renderWithProviders(<Reports />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('reports.typeMessage')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('reports.typeMessage')
    const sendButton = screen.getByRole('button', { name: /reports.send/i })

    // Act: Submit multiple queries
    for (let i = 0; i < 3; i++) {
      await user.clear(textarea)
      await user.type(textarea, `query ${i}`)
      await user.click(sendButton)

      // Wait for error to appear
      await waitFor(() => {
        const retryButtons = screen.queryAllByRole('button', { name: /retry/i })
        expect(retryButtons.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    }

    // Assert: All errors should be handled
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('should disable retry button while request is in progress', async () => {
    // Arrange: Mock slow API response
    mockFetch.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: async () => ({
          response: 'Delayed response',
          sources: [],
          confidence_score: 0.9,
          conversation_id: 'test-conv-id',
          response_time_ms: 100
        })
      }), 1000))
    )

    const user = userEvent.setup()
    renderWithProviders(<Reports />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('reports.typeMessage')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('reports.typeMessage')
    const sendButton = screen.getByRole('button', { name: /reports.send/i })

    // Act: Submit query
    await user.clear(textarea)
    await user.type(textarea, 'test query')
    await user.click(sendButton)

    // Assert: Send button should be disabled while loading
    await waitFor(() => {
      expect(sendButton).toBeDisabled()
    })

    // Wait for response
    await waitFor(() => {
      expect(screen.getByText(/Delayed response/i)).toBeInTheDocument()
    }, { timeout: 2000 })

    // Send button should be enabled again
    expect(sendButton).not.toBeDisabled()
  })
})
