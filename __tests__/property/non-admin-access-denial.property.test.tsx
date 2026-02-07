/**
 * Property-Based Test: Non-Admin Access Denial
 * 
 * Feature: ai-empowered-ppm-features
 * Property 38: Non-Admin Access Denial
 * 
 * For any non-admin user attempting to access /admin routes, the Frontend SHALL 
 * either redirect to the home page OR display an access denied message.
 * 
 * Validates: Requirements 10.5
 */

import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import * as fc from 'fast-check'
import { useRouter } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the auth provider
const mockUseAuth = jest.fn()
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth()
}))

// Mock the API
global.fetch = jest.fn()

// Mock AppLayout
jest.mock('@/components/shared/AppLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>
}))

// Mock translations
jest.mock('@/lib/i18n/context', () => ({
  useTranslations: () => (key: string) => key
}))

// Import the component after mocks are set up
import AdminUsers from '@/app/admin/users/page'

// Arbitraries for generating test data
const nonAdminRoleArb = fc.constantFrom(
  'portfolio_manager',
  'project_manager',
  'resource_manager',
  'team_member',
  'viewer'
)

const userIdArb = fc.uuid()
const emailArb = fc.emailAddress()
// Generate valid alphanumeric access tokens (not whitespace-only)
const accessTokenArb = fc.stringMatching(/^[a-zA-Z0-9]{20,50}$/)

describe('Property 38: Non-Admin Access Denial', () => {
  let mockPush: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    mockPush = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
    })

    // Suppress console errors for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  test('Non-admin users receive 403 Forbidden when accessing admin endpoints', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAdminRoleArb,
        userIdArb,
        emailArb,
        accessTokenArb,
        async (role, userId, email, accessToken) => {
          // Mock non-admin user session
          const session = {
            access_token: accessToken,
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: userId, email, role }
          }

          mockUseAuth.mockReturnValue({
            session,
            user: session.user,
            loading: false,
            error: null,
            clearSession: jest.fn()
          })

          // Mock API response with 403 Forbidden
          ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({ detail: 'Forbidden' })
          })

          let container: HTMLElement
          let unmount: () => void

          await act(async () => {
            const result = render(<AdminUsers />)
            container = result.container
            unmount = result.unmount
          })

          // Wait for the access check to complete
          await act(async () => {
            await waitFor(() => {
              expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/admin/roles'),
                expect.objectContaining({
                  headers: expect.objectContaining({
                    'Authorization': `Bearer ${accessToken}`
                  })
                })
              )
            }, { timeout: 3000 })
          })

          // Verify access denied message is displayed
          await act(async () => {
            await waitFor(() => {
              const content = container!.textContent || ''
              expect(content).toContain('Access Denied')
            }, { timeout: 3000 })
          })

          // Verify the page shows appropriate error messaging
          const content = container!.textContent || ''
          expect(content.toLowerCase()).toMatch(/access denied|permission|administrator/i)

          // Verify no white page
          expect(content).not.toBe('')
          expect(content.trim()).not.toBe('')

          unmount!()
          
          // Clear mocks for next iteration
          ;(global.fetch as jest.Mock).mockClear()
        }
      ),
      { numRuns: 10, timeout: 10000 }
    )
  })

  test('Non-admin users are redirected to home page after access denial', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAdminRoleArb,
        userIdArb,
        emailArb,
        accessTokenArb,
        async (role, userId, email, accessToken) => {
          // Mock non-admin user session
          const session = {
            access_token: accessToken,
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: userId, email, role }
          }

          mockUseAuth.mockReturnValue({
            session,
            user: session.user,
            loading: false,
            error: null,
            clearSession: jest.fn()
          })

          // Mock API response with 403 Forbidden
          ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({ detail: 'Forbidden' })
          })

          let unmount: () => void

          await act(async () => {
            const result = render(<AdminUsers />)
            unmount = result.unmount
          })

          // Wait for the access check to complete
          await act(async () => {
            await waitFor(() => {
              expect(global.fetch).toHaveBeenCalled()
            }, { timeout: 3000 })
          })

          // Advance timers to trigger the redirect (component uses 2000ms delay)
          await act(async () => {
            jest.advanceTimersByTime(2500)
          })

          // Wait for redirect to be called
          expect(mockPush).toHaveBeenCalledWith('/')

          unmount!()
          
          // Clear mocks for next iteration
          ;(global.fetch as jest.Mock).mockClear()
          mockPush.mockClear()
        }
      ),
      { numRuns: 10, timeout: 10000 }
    )
  })

  test('Admin users can access admin page without denial', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        emailArb,
        accessTokenArb,
        async (userId, email, accessToken) => {
          // Mock admin user session
          const session = {
            access_token: accessToken,
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: userId, email, role: 'admin' }
          }

          mockUseAuth.mockReturnValue({
            session,
            user: session.user,
            loading: false,
            error: null,
            clearSession: jest.fn()
          })

          // Mock successful API responses for admin
          ;(global.fetch as jest.Mock)
            .mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ([
                { role: 'admin', permissions: ['all'], description: 'Administrator' }
              ])
            })
            .mockResolvedValueOnce({
              ok: true,
              status: 200,
              json: async () => ({
                users: [],
                total_count: 0,
                page: 1,
                per_page: 20,
                total_pages: 0
              })
            })

          let container: HTMLElement
          let unmount: () => void

          await act(async () => {
            const result = render(<AdminUsers />)
            container = result.container
            unmount = result.unmount
          })

          // Wait for the page to load
          await act(async () => {
            await waitFor(() => {
              expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/admin/roles'),
                expect.any(Object)
              )
            }, { timeout: 3000 })
          })

          // Verify NO access denied message
          await act(async () => {
            await waitFor(() => {
              const content = container!.textContent || ''
              expect(content).not.toContain('Access Denied')
            }, { timeout: 3000 })
          })

          // Verify NO redirect was called
          expect(mockPush).not.toHaveBeenCalledWith('/')

          unmount!()
          
          // Clear mocks for next iteration
          ;(global.fetch as jest.Mock).mockClear()
          mockPush.mockClear()
        }
      ),
      { numRuns: 10, timeout: 10000 }
    )
  })

  test('Unauthenticated users see appropriate message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null),
        async (session) => {
          // Mock unauthenticated state
          mockUseAuth.mockReturnValue({
            session,
            user: null,
            loading: false,
            error: null,
            clearSession: jest.fn()
          })

          let container: HTMLElement
          let unmount: () => void

          await act(async () => {
            const result = render(<AdminUsers />)
            container = result.container
            unmount = result.unmount
          })

          // Wait for component to render
          await act(async () => {
            await waitFor(() => {
              // Component should render something (either loading spinner or content)
              expect(container!.querySelector('[data-testid="app-layout"]')).toBeInTheDocument()
            }, { timeout: 3000 })
          })

          // Verify no white page - component should render within AppLayout
          // When unauthenticated, the component shows a loading spinner
          const appLayout = container!.querySelector('[data-testid="app-layout"]')
          expect(appLayout).toBeInTheDocument()
          expect(appLayout!.innerHTML).not.toBe('')

          unmount!()
        }
      ),
      { numRuns: 5, timeout: 10000 }
    )
  })

  test('Access control check happens before rendering admin content', async () => {
    await fc.assert(
      fc.asyncProperty(
        nonAdminRoleArb,
        userIdArb,
        emailArb,
        accessTokenArb,
        async (role, userId, email, accessToken) => {
          // Mock non-admin user session
          const session = {
            access_token: accessToken,
            refresh_token: 'refresh-token',
            expires_in: 3600,
            token_type: 'bearer',
            user: { id: userId, email, role }
          }

          mockUseAuth.mockReturnValue({
            session,
            user: session.user,
            loading: false,
            error: null,
            clearSession: jest.fn()
          })

          // Mock API response with 403 Forbidden
          ;(global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({ detail: 'Forbidden' })
          })

          let container: HTMLElement
          let unmount: () => void

          await act(async () => {
            const result = render(<AdminUsers />)
            container = result.container
            unmount = result.unmount
          })

          // Wait for access check
          await act(async () => {
            await waitFor(() => {
              expect(global.fetch).toHaveBeenCalled()
            }, { timeout: 3000 })
          })

          // Verify admin-specific content is NOT rendered
          const content = container!.textContent || ''
          
          // Should not show user management features
          expect(content).not.toContain('Invite User')
          expect(content).not.toContain('Bulk Actions')
          
          // Should show access denial instead
          expect(content).toContain('Access Denied')

          unmount!()
          
          // Clear mocks for next iteration
          ;(global.fetch as jest.Mock).mockClear()
        }
      ),
      { numRuns: 10, timeout: 10000 }
    )
  })
})
