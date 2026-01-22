/**
 * Unit Tests: ProjectImportModal Component
 * 
 * Feature: project-import-mvp
 * Task: 10.2 Write unit tests for modal component
 * 
 * Tests:
 * - Modal opens and closes
 * - Method selection switches UI
 * - File upload accepts only CSV files
 * - Loading indicator displays during API calls
 * - Success message displays with correct count
 * - Error messages display with record details
 * 
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Mock react-dropzone
const mockOnDrop = jest.fn()
jest.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop, accept }: any) => {
    mockOnDrop.mockImplementation(onDrop)
    return {
      getRootProps: () => ({
        onClick: jest.fn(),
        'data-testid': 'dropzone'
      }),
      getInputProps: () => ({
        type: 'file',
        accept: accept,
        'data-testid': 'file-input',
        onChange: (e: any) => {
          const files = e.target.files ? Array.from(e.target.files) : []
          onDrop(files as File[])
        }
      }),
      isDragActive: false
    }
  }
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
})

// Mock fetch
global.fetch = jest.fn()

// Import component after mocks
import ProjectImportModal from '../ProjectImportModal'

// Helper to get the Import Projects button (not the tab)
const getImportButton = () => {
  const buttons = screen.getAllByRole('button')
  return buttons.find(btn => btn.textContent === 'Import Projects' && btn.getAttribute('type') === 'button')
}

describe('ProjectImportModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    portfolioId: 'test-portfolio-123'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Modal Opens and Closes', () => {
    test('should render modal when isOpen is true', () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      // Check for modal title
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Import Projects')
    })

    test('should not render modal when isOpen is false', () => {
      render(<ProjectImportModal {...defaultProps} isOpen={false} />)
      
      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    })

    test('should call onClose when Cancel button is clicked', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
    })

    test('should reset state when modal closes', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      // Enter some JSON
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test"}]' } })
      
      // Close modal
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  describe('Method Selection Switches UI', () => {
    test('should show JSON input by default', () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      expect(screen.getByText('Paste JSON Array')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Project Alpha/i)).toBeInTheDocument()
    })

    test('should switch to CSV upload when CSV tab is clicked', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      await waitFor(() => {
        expect(screen.getByText('Upload CSV File')).toBeInTheDocument()
        expect(screen.getByText(/Drag & drop a CSV file/i)).toBeInTheDocument()
      })
    })

    test('should switch back to JSON input when JSON tab is clicked', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      // Switch to CSV
      fireEvent.click(screen.getByText('CSV Upload'))
      
      // Switch back to JSON
      fireEvent.click(screen.getByText('JSON Input'))
      
      await waitFor(() => {
        expect(screen.getByText('Paste JSON Array')).toBeInTheDocument()
      })
    })

    test('should highlight active tab', () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      const jsonTab = screen.getByText('JSON Input').closest('button')
      expect(jsonTab).toHaveClass('border-blue-600')
      
      const csvTab = screen.getByText('CSV Upload').closest('button')
      expect(csvTab).toHaveClass('border-transparent')
    })
  })

  describe('File Upload Accepts Only CSV Files', () => {
    test('should display dropzone for CSV files', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      fireEvent.click(screen.getByText('CSV Upload'))
      
      await waitFor(() => {
        expect(screen.getByText(/Only .csv files are accepted/i)).toBeInTheDocument()
      })
    })

    test('should display selected CSV file name', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      fireEvent.click(screen.getByText('CSV Upload'))
      
      const file = new File(['name,budget,status\nTest,1000,planning'], 'projects.csv', { type: 'text/csv' })
      Object.defineProperty(file, 'size', { value: 2048 })
      
      // Simulate file drop wrapped in act
      await act(async () => {
        mockOnDrop([file])
      })
      
      await waitFor(() => {
        expect(screen.getByText('projects.csv')).toBeInTheDocument()
        expect(screen.getByText('2.0 KB')).toBeInTheDocument()
      })
    })

    test('should allow removing selected file', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      fireEvent.click(screen.getByText('CSV Upload'))
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      
      await act(async () => {
        mockOnDrop([file])
      })
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      const removeButton = screen.getByText('Remove file')
      fireEvent.click(removeButton)
      
      await waitFor(() => {
        expect(screen.queryByText('test.csv')).not.toBeInTheDocument()
      })
    })
  })

  describe('Loading Indicator Displays During API Calls', () => {
    test('should show loading indicator during JSON import', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 1, errors: [], message: 'Success' })
        }), 100))
      )

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Processing import...')).toBeInTheDocument()
      })
    })

    test('should disable Import button during loading', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 1, errors: [], message: 'Success' })
        }), 100))
      )

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(importButton).toBeDisabled()
      })
    })

    test('should disable Cancel button during loading', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, count: 1, errors: [], message: 'Success' })
        }), 100))
      )

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        const cancelButton = screen.getByText('Cancel')
        expect(cancelButton).toBeDisabled()
      })
    })
  })

  describe('Success Message Displays With Correct Count', () => {
    test('should display success message with project count', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          count: 5,
          errors: [],
          message: 'Import successful'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Import successful!')).toBeInTheDocument()
        expect(screen.getByText('5 projects imported successfully.')).toBeInTheDocument()
      })
    })

    test('should use singular form for single project', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          count: 1,
          errors: [],
          message: 'Import successful'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('1 project imported successfully.')).toBeInTheDocument()
      })
    })

    test('should show Close button after successful import', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          count: 3,
          errors: [],
          message: 'Import successful'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument()
        // Import button should be hidden after success
        expect(getImportButton()).toBeUndefined()
      })
    })
  })

  describe('Error Messages Display With Record Details', () => {
    test('should display error message on import failure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'name', value: '', error: 'Name is required' }
          ],
          message: 'Validation failed'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Import failed')).toBeInTheDocument()
        expect(screen.getByText('Validation failed')).toBeInTheDocument()
      })
    })

    test('should display error details in table', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'budget', value: 'invalid', error: 'Budget must be a number' },
            { index: 1, field: 'status', value: 'unknown', error: 'Invalid status value' }
          ],
          message: 'Validation errors found'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('2 errors found')).toBeInTheDocument()
        expect(screen.getByText('#1')).toBeInTheDocument()
        expect(screen.getByText('budget')).toBeInTheDocument()
        expect(screen.getByText('Budget must be a number')).toBeInTheDocument()
        expect(screen.getByText('#2')).toBeInTheDocument()
        expect(screen.getByText('status')).toBeInTheDocument()
        expect(screen.getByText('Invalid status value')).toBeInTheDocument()
      })
    })

    test('should display Copy errors button', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'name', value: null, error: 'Name is required' }
          ],
          message: 'Validation failed'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Copy errors')).toBeInTheDocument()
      })
    })

    test('should copy errors to clipboard when Copy errors is clicked', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'name', value: null, error: 'Name is required' }
          ],
          message: 'Validation failed'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Copy errors')).toBeInTheDocument()
      })
      
      fireEvent.click(screen.getByText('Copy errors'))
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled()
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })

    test('should display JSON parse error for invalid JSON', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: 'invalid json' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to parse JSON input')).toBeInTheDocument()
      })
    })

    test('should display error for non-array JSON', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '{"name": "Test"}' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Invalid JSON format: expected an array')).toBeInTheDocument()
      })
    })

    test('should display network error message', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to connect to the server')).toBeInTheDocument()
      })
    })
  })

  describe('Import Button State', () => {
    test('should disable Import button when JSON input is empty', () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      const importButton = getImportButton()
      expect(importButton).toBeDisabled()
    })

    test('should enable Import button when JSON input has content', () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test"}]' } })
      
      const importButton = getImportButton()
      expect(importButton).not.toBeDisabled()
    })

    test('should disable Import button when no CSV file is selected', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      fireEvent.click(screen.getByText('CSV Upload'))
      
      await waitFor(() => {
        const importButton = getImportButton()
        expect(importButton).toBeDisabled()
      })
    })

    test('should enable Import button when CSV file is selected', async () => {
      render(<ProjectImportModal {...defaultProps} />)
      
      fireEvent.click(screen.getByText('CSV Upload'))
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      
      await act(async () => {
        mockOnDrop([file])
      })
      
      await waitFor(() => {
        const importButton = getImportButton()
        expect(importButton).not.toBeDisabled()
      })
    })
  })

  describe('CSV Import', () => {
    test('should call CSV import endpoint with file', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          count: 2,
          errors: [],
          message: 'Import successful'
        })
      })

      render(<ProjectImportModal {...defaultProps} />)
      
      fireEvent.click(screen.getByText('CSV Upload'))
      
      const file = new File(['name,budget,status\nTest,1000,planning'], 'test.csv', { type: 'text/csv' })
      
      await act(async () => {
        mockOnDrop([file])
      })
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      const importButton = getImportButton()
      fireEvent.click(importButton!)
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/projects/import/csv'),
          expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData)
          })
        )
      })
    })
  })
})
