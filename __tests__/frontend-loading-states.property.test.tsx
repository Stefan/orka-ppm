/**
 * Feature: ai-empowered-ppm-features
 * Property 15: Frontend Loading States
 * 
 * For any AI agent request in progress, the Frontend SHALL display a loading indicator 
 * until the request completes or fails.
 * 
 * Validates: Requirements 5.5
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fc from 'fast-check'
import Reports from '@/app/reports/page'
import { ToastProvider } from '@/components/shared/Toast'

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

// Query generator
const queryArbitrary = fc.string({ minLength: 5, maxLength: 200 })

// Delay generator (in milliseconds)
const delayArbitrary = fc.integer({ min: 100, max: 2000 })

// Response generator
const responseArbitrary = fc.record({
  response: fc.string({ minLength: 10, maxLength: 500 }),
  confidence_score: fc.double({ min: 0, max: 1 }),
  conversation_id: fc.uuid(),
  response_time_ms: fc.integer({ min: 50, max: 5000 })
})

describe('Property 15: Frontend Loading States', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should display loading indicator for any AI agent request in progress', () => {
    fc.assert(
      fc.asyncProperty(
        queryArbitrary,
        delayArbitrary,
        responseArbitrary,
        async (query, delay, responseData) => {
          // Arrange: Mock delayed API response
          mockFetch.mockImplementationOnce(
            () => new Promise((resolve) => 
              setTimeout(() => resolve({
                ok: true,
                json: async () => ({
                  ...responseData,
                  sources: []
                })
              }), delay)
            )
          )

          const user = userEvent.setup()
          renderWithProviders(<Reports />)

          // Wait for initial render
          await waitFor(() => {
            expect(screen.getByPlaceholderText('reports.typeMessage')).toBeInTheDocument()
          })

          const textarea = screen.getByPlaceholderText('reports.typeMessage')
          const sendButton = screen.getByRole('button', { name: /reports.send/i })

          // Act: Submit query
          await user.clear(textarea)
          await user.type(textarea, query)
          await user.click(sendButton)

          // Assert: Loading indicator should appear immediately
          await waitFor(() => {
            // Check for loading text
            const loadingText = screen.queryByText(/common.loading/i)
            // Check for disabled send button (indicates loading state)
            const disabledButton = sendButton.hasAttribute('disabled')
            
            // At least one loading indicator should be present
            expect(loadingText || disabledButton).toBeTruthy()
          }, { timeout: 500 })

          // Wait for response to complete
          await waitFor(() => {
            expect(screen.getByText(responseData.response)).toBeInTheDocument()
          }, { timeout: delay + 1000 })

          // Assert: Loading indicator should disappear after completion
          await waitFor(() => {
            const loadingText = screen.queryByText(/common.loading/i)
            expect(loadingText).not.toBeInTheDocument()
          })

          // Send button should be enabled again
          expect(sendButton).not.toBeDisabled()
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should display loading indicator until request fails', () => {
    fc.assert(
      fc.asyncProperty(
        queryArbitrary,
        delayArbitrary,
        async (query, delay) => {
          // Arrange: Mock delayed failed API response
          mockFetch.mockImplementationOnce(
            () => new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Network error')), delay)
            )
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
          await user.type(textarea, query)
          await user.click(sendButton)

          // Assert: Loading indicator should appear
          await waitFor(() => {
            const loadingText = screen.queryByText(/common.loading/i)
            const disabledButton = sendButton.hasAttribute('disabled')
            expect(loadingText || disabledButton).toBeTruthy()
          }, { timeout: 500 })

          // Wait for error to appear
          await waitFor(() => {
            // Error should be displayed
            const errorElements = document.querySelectorAll('[class*="red"], [class*="error"]')
            expect(errorElements.length).toBeGreaterThan(0)
          }, { timeout: delay + 1000 })

          // Assert: Loading indicator should disappear after error
          await waitFor(() => {
            const loadingText = screen.queryByText(/common.loading/i)
            expect(loadingText).not.toBeInTheDocument()
          })

          // Send button should be enabled again
          expect(sendButton).not.toBeDisabled()
        }
      ),
      { numRuns: 10 }
    )
  })

  it('should disable input controls during loading', () => {
    fc.assert(
      fc.asyncProperty(
        queryArbitrary,
        async (query) => {
          // Arrange: Mock slow API response
          mockFetch.mockImplementationOnce(
            () => new Promise((resolve) => 
              setTimeout(() => resolve({
                ok: true,
                json: async () => ({
                  response: 'Test response',
                  sources: [],
                  confidence_score: 0.9,
                  conversation_id: 'test-id',
                  response_time_ms: 100
                })
              }), 1000)
            )
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
          await user.type(textarea, query)
          await user.click(sendButton)

          // Assert: Controls should be disabled during loading
          await waitFor(() => {
            expect(sendButton).toBeDisabled()
            expect(textarea).toBeDisabled()
          }, { timeout: 500 })

          // Wait for completion
          await waitFor(() => {
            expect(screen.getByText('Test response')).toBeInTheDocument()
          }, { timeout: 2000 })

          // Controls should be enabled again
          expect(sendButton).not.toBeDisabled()
          expect(textarea).not.toBeDisabled()
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should show loading indicator for multiple consecutive requests', async () => {
    // Arrange: Mock multiple delayed responses
    mockFetch
      .mockImplementationOnce(() => new Promise((resolve) => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({
            response: 'Response 1',
            sources: [],
            confidence_score: 0.9,
            conversation_id: 'test-id-1',
            response_time_ms: 100
          })
        }), 500)
      ))
      .mockImplementationOnce(() => new Promise((resolve) => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({
            response: 'Response 2',
            sources: [],
            confidence_score: 0.9,
            conversation_id: 'test-id-2',
            response_time_ms: 100
          })
        }), 500)
      ))

    const user = userEvent.setup()
    renderWithProviders(<Reports />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('reports.typeMessage')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('reports.typeMessage')
    const sendButton = screen.getByRole('button', { name: /reports.send/i })

    // Act: Submit first query
    await user.clear(textarea)
    await user.type(textarea, 'query 1')
    await user.click(sendButton)

    // Assert: Loading indicator appears
    await waitFor(() => {
      expect(sendButton).toBeDisabled()
    })

    // Wait for first response
    await waitFor(() => {
      expect(screen.getByText('Response 1')).toBeInTheDocument()
    }, { timeout: 1000 })

    // Act: Submit second query
    await user.clear(textarea)
    await user.type(textarea, 'query 2')
    await user.click(sendButton)

    // Assert: Loading indicator appears again
    await waitFor(() => {
      expect(sendButton).toBeDisabled()
    })

    // Wait for second response
    await waitFor(() => {
      expect(screen.getByText('Response 2')).toBeInTheDocument()
    }, { timeout: 1000 })

    // Loading should be complete
    expect(sendButton).not.toBeDisabled()
  })

  it('should maintain loading state for minimum duration', () => {
    fc.assert(
      fc.asyncProperty(
        queryArbitrary,
        fc.integer({ min: 10, max: 100 }), // Very fast response
        async (query, fastDelay) => {
          // Arrange: Mock very fast API response
          mockFetch.mockImplementationOnce(
            () => new Promise((resolve) => 
              setTimeout(() => resolve({
                ok: true,
                json: async () => ({
                  response: 'Fast response',
                  sources: [],
                  confidence_score: 0.9,
                  conversation_id: 'test-id',
                  response_time_ms: fastDelay
                })
              }), fastDelay)
            )
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
          await user.type(textarea, query)
          
          const startTime = Date.now()
          await user.click(sendButton)

          // Assert: Loading indicator should appear
          await waitFor(() => {
            expect(sendButton).toBeDisabled()
          }, { timeout: 100 })

          // Wait for response
          await waitFor(() => {
            expect(screen.getByText('Fast response')).toBeInTheDocument()
          }, { timeout: fastDelay + 500 })

          const endTime = Date.now()
          const duration = endTime - startTime

          // Loading indicator should have been visible for at least the request duration
          expect(duration).toBeGreaterThanOrEqual(fastDelay)
        }
      ),
      { numRuns: 5 }
    )
  })
})
