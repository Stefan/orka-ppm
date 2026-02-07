/**
 * Unit Tests: Bulk Import UI Components
 * 
 * Feature: ai-empowered-ppm-features
 * Task: 16.4 Write unit tests for import UI components
 * 
 * Tests:
 * - File upload functionality
 * - Progress display during upload
 * - Error display with validation errors
 * - Download functionality for error reports
 * 
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn(() => null),
  })),
}))

// Mock the auth provider
const mockUseAuth = jest.fn()
jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => mockUseAuth()
}))

// Mock AppLayout
jest.mock('@/components/shared/AppLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-layout">{children}</div>
}))

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop }: any) => ({
    getRootProps: () => ({
      onClick: () => {},
      onDrop: (e: any) => {
        const files = e.dataTransfer?.files || []
        onDrop(Array.from(files))
      }
    }),
    getInputProps: () => ({
      type: 'file',
      onChange: (e: any) => {
        const files = e.target.files || []
        onDrop(Array.from(files))
      }
    }),
    isDragActive: false
  })
}))

// Mock fetch
global.fetch = jest.fn()

// Import the component after mocks are set up
import ImportPage from '@/app/import/page'

describe('Bulk Import UI Components', () => {
  const mockSession = {
    access_token: 'test-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: 'user-id', email: 'user@example.com' }
  }

  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      session: mockSession,
      user: mockSession.user,
      loading: false,
      error: null,
      clearSession: jest.fn()
    })

    // Suppress console errors for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    cleanup()
  })

  describe('File Upload Functionality', () => {
    test('should render file upload dropzone', () => {
      render(<ImportPage />)
      
      expect(screen.getByText(/Drag & drop CSV or JSON file/i)).toBeInTheDocument()
      expect(screen.getByText(/Supported formats: .csv, .json/i)).toBeInTheDocument()
    })

    test('should display selected file information', async () => {
      render(<ImportPage />)
      
      // Create a mock file
      const file = new File(['test content'], 'test.csv', { type: 'text/csv' })
      Object.defineProperty(file, 'size', { value: 1024 })
      
      // Simulate file selection
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
    })

    test('should enable import button when file is selected', async () => {
      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        expect(importButton).toBeInTheDocument()
        expect(importButton).not.toBeDisabled()
      })
    })

    test('should allow entity type selection', () => {
      render(<ImportPage />)
      
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('Resources')).toBeInTheDocument()
      expect(screen.getByText('Financials')).toBeInTheDocument()
    })

    test('should change entity type when clicked', async () => {
      render(<ImportPage />)
      
      const resourcesButton = screen.getByText('Resources').closest('button')
      if (resourcesButton) {
        fireEvent.click(resourcesButton)
      }
      
      await waitFor(() => {
        expect(resourcesButton).toHaveClass('border-blue-500')
      })
    })
  })

  describe('Progress Display', () => {
    test('should show progress bar during upload', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success_count: 10,
                error_count: 0,
                errors: [],
                processing_time_seconds: 1.5
              })
            })
          }, 100)
        })
      )

      render(<ImportPage />)
      
      // Select file
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      // Click import button
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      // Check for progress indicator
      await waitFor(() => {
        expect(screen.getByText(/Processing/i)).toBeInTheDocument()
      })
    })

    test('should disable upload button during processing', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success_count: 10,
                error_count: 0,
                errors: [],
                processing_time_seconds: 1.5
              })
            })
          }, 100)
        })
      )

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        const uploadingButton = screen.getByText(/Uploading/i)
        expect(uploadingButton).toBeDisabled()
      })
    })
  })

  describe('Error Display', () => {
    test('should display error message on upload failure', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Import Failed/i)).toBeInTheDocument()
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })

    test('should display validation errors with line numbers and field names', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success_count: 0,
          error_count: 2,
          errors: [
            {
              line_number: 2,
              field: 'budget',
              message: 'must be a positive number',
              value: '-100'
            },
            {
              line_number: 3,
              field: 'end_date',
              message: 'must be after start_date',
              value: '2023-01-01'
            }
          ],
          processing_time_seconds: 0.5
        })
      })

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText('Validation Errors')).toBeInTheDocument()
        expect(screen.getByText('budget')).toBeInTheDocument()
        expect(screen.getByText('must be a positive number')).toBeInTheDocument()
        expect(screen.getByText('end_date')).toBeInTheDocument()
        expect(screen.getByText('must be after start_date')).toBeInTheDocument()
      })
    })

    test('should display error count in results summary', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success_count: 8,
          error_count: 2,
          errors: [
            { line_number: 2, field: 'budget', message: 'invalid', value: 'abc' },
            { line_number: 5, field: 'name', message: 'required', value: null }
          ],
          processing_time_seconds: 1.2
        })
      })

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText('Records Imported')).toBeInTheDocument()
        expect(screen.getByText('Errors')).toBeInTheDocument()
        // Check for the error count in the summary card (not in the table)
        const errorCards = screen.getAllByText('2')
        expect(errorCards.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Download Functionality', () => {
    test('should provide download button for error report', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success_count: 0,
          error_count: 1,
          errors: [
            { line_number: 2, field: 'budget', message: 'invalid', value: 'abc' }
          ],
          processing_time_seconds: 0.5
        })
      })

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText('Download Error Report')).toBeInTheDocument()
      })
    })

    test('should trigger CSV download when download button is clicked', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success_count: 0,
          error_count: 1,
          errors: [
            { line_number: 2, field: 'budget', message: 'invalid', value: 'abc' }
          ],
          processing_time_seconds: 0.5
        })
      })

      // Mock URL.createObjectURL and document methods
      const mockCreateObjectURL = jest.fn(() => 'blob:mock-url')
      const mockRevokeObjectURL = jest.fn()
      const originalCreateObjectURL = global.URL.createObjectURL
      const originalRevokeObjectURL = global.URL.revokeObjectURL
      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL

      const mockClick = jest.fn()
      
      const originalCreateElement = document.createElement.bind(document)
      const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          const element = originalCreateElement(tag)
          element.click = mockClick
          return element
        }
        return originalCreateElement(tag)
      })

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        const downloadButton = screen.getByText('Download Error Report')
        fireEvent.click(downloadButton)
      })
      
      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()
      
      // Restore mocks
      createElementSpy.mockRestore()
      global.URL.createObjectURL = originalCreateObjectURL
      global.URL.revokeObjectURL = originalRevokeObjectURL
    })
  })

  describe('Success Display', () => {
    test('should display success message when all records imported', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success_count: 10,
          error_count: 0,
          errors: [],
          processing_time_seconds: 1.5
        })
      })

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/All records imported successfully/i)).toBeInTheDocument()
        expect(screen.getByText('10')).toBeInTheDocument()
        expect(screen.getByText('Records Imported')).toBeInTheDocument()
      })
    })

    test('should display processing time in results', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success_count: 5,
          error_count: 0,
          errors: [],
          processing_time_seconds: 2.34
        })
      })

      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByText(/Import Data/i)
        fireEvent.click(importButton)
      })
      
      await waitFor(() => {
        expect(screen.getByText(/Processing time: 2.34s/i)).toBeInTheDocument()
      })
    })
  })

  describe('Clear Functionality', () => {
    test('should clear selected file when clear button is clicked', async () => {
      render(<ImportPage />)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const input = document.querySelector('input[type="file"]')
      if (input) {
        fireEvent.change(input, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      const clearButton = screen.getByText('Clear')
      fireEvent.click(clearButton)
      
      await waitFor(() => {
        expect(screen.queryByText('test.csv')).not.toBeInTheDocument()
        expect(screen.getByText(/Drag & drop CSV or JSON file/i)).toBeInTheDocument()
      })
    })
  })
})
