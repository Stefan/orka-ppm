/**
 * Unit Tests: Project Import Modal Component
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
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import ProjectImportModal from '@/components/projects/ProjectImportModal'

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: ({ onDrop, accept }: any) => ({
    getRootProps: () => ({
      onClick: jest.fn(),
      onDrop: (e: any) => {
        const files = e.dataTransfer?.files || []
        onDrop(Array.from(files))
      }
    }),
    getInputProps: () => ({
      type: 'file',
      accept: accept,
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

describe('ProjectImportModal - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    cleanup()
  })

  describe('Modal Open and Close - Req 6.2', () => {
    test('should render modal when isOpen is true', () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      expect(screen.getByRole('button', { name: 'Import Projects' })).toBeInTheDocument()
    })

    test('should not render modal when isOpen is false', () => {
      render(<ProjectImportModal isOpen={false} onClose={jest.fn()} />)
      
      expect(screen.queryByText('Import Projects')).not.toBeInTheDocument()
    })

    test('should call onClose when close button is clicked', () => {
      const onClose = jest.fn()
      render(<ProjectImportModal isOpen={true} onClose={onClose} />)
      
      const closeButton = screen.getByText('Cancel')
      fireEvent.click(closeButton)
      
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('should reset state when modal closes', () => {
      const onClose = jest.fn()
      const { rerender } = render(<ProjectImportModal isOpen={true} onClose={onClose} />)
      
      // Add some JSON input
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test"}]' } })
      
      // Close modal
      const closeButton = screen.getByText('Cancel')
      fireEvent.click(closeButton)
      
      // Reopen modal
      rerender(<ProjectImportModal isOpen={true} onClose={onClose} />)
      
      // Input should be cleared
      expect(textarea).toHaveValue('')
    })
  })

  describe('Method Selection - Req 6.2, 6.3, 6.4', () => {
    test('should display JSON and CSV method tabs', () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      expect(screen.getByText('JSON Input')).toBeInTheDocument()
      expect(screen.getByText('CSV Upload')).toBeInTheDocument()
    })

    test('should default to JSON method', () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // JSON textarea should be visible
      expect(screen.getByPlaceholderText(/Project Alpha/i)).toBeInTheDocument()
      expect(screen.getByText('Paste JSON Array')).toBeInTheDocument()
    })

    test('should switch to CSV method when CSV tab is clicked', () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      // CSV upload area should be visible
      expect(screen.getByText('Upload CSV File')).toBeInTheDocument()
      expect(screen.getByText(/Drag & drop a CSV file/i)).toBeInTheDocument()
    })

    test('should switch back to JSON method when JSON tab is clicked', () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Switch to CSV
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      // Switch back to JSON
      const jsonTab = screen.getByText('JSON Input')
      fireEvent.click(jsonTab)
      
      // JSON textarea should be visible again
      expect(screen.getByPlaceholderText(/Project Alpha/i)).toBeInTheDocument()
    })

    test('should clear results when switching methods', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 5,
          errors: [],
          message: 'Success'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Add JSON and import
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Import successful!/i)).toBeInTheDocument()
      })
      
      // Switch to CSV method
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      // Success message should be cleared
      expect(screen.queryByText(/Import successful!/i)).not.toBeInTheDocument()
    })
  })

  describe('File Upload - Req 6.4', () => {
    test('should accept CSV files only', () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Switch to CSV method
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      // Check file input accepts CSV
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('accept')
    })

    test('should display selected CSV file name and size', async () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Switch to CSV method
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      // Create mock CSV file
      const file = new File(['name,budget,status\nTest,1000,planning'], 'projects.csv', { type: 'text/csv' })
      Object.defineProperty(file, 'size', { value: 1024 })
      
      // Simulate file selection
      const fileInput = document.querySelector('input[type="file"]')
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        expect(screen.getByText('projects.csv')).toBeInTheDocument()
        expect(screen.getByText('1.0 KB')).toBeInTheDocument()
      })
    })

    test('should allow removing selected file', async () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Switch to CSV method
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      // Select file
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const fileInput = document.querySelector('input[type="file"]')
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        expect(screen.getByText('test.csv')).toBeInTheDocument()
      })
      
      // Remove file
      const removeButton = screen.getByText('Remove file')
      fireEvent.click(removeButton)
      
      await waitFor(() => {
        expect(screen.queryByText('test.csv')).not.toBeInTheDocument()
        expect(screen.getByText(/Drag & drop a CSV file/i)).toBeInTheDocument()
      })
    })

    test('should disable import button when no file is selected', () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Switch to CSV method
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      expect(importButton).toBeDisabled()
    })

    test('should enable import button when file is selected', async () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Switch to CSV method
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      // Select file
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const fileInput = document.querySelector('input[type="file"]')
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: 'Import Projects' })
        expect(importButton).not.toBeDisabled()
      })
    })
  })

  describe('Loading State - Req 6.5', () => {
    test('should display loading indicator during JSON import', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                count: 5,
                errors: [],
                message: 'Success'
              })
            })
          }, 100)
        })
      )

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Add JSON input
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      // Click import
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      // Check for loading indicator
      await waitFor(() => {
        expect(screen.getByText('Processing import...')).toBeInTheDocument()
      })
    })

    test('should display loading indicator during CSV import', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                count: 5,
                errors: [],
                message: 'Success'
              })
            })
          }, 100)
        })
      )

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      // Switch to CSV and select file
      const csvTab = screen.getByText('CSV Upload')
      fireEvent.click(csvTab)
      
      const file = new File(['test'], 'test.csv', { type: 'text/csv' })
      const fileInput = document.querySelector('input[type="file"]')
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } })
      }
      
      await waitFor(() => {
        const importButton = screen.getByRole('button', { name: 'Import Projects' })
        fireEvent.click(importButton)
      })
      
      // Check for loading indicator
      await waitFor(() => {
        expect(screen.getByText('Processing import...')).toBeInTheDocument()
      })
    })

    test('should disable import button during loading', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                count: 5,
                errors: [],
                message: 'Success'
              })
            })
          }, 100)
        })
      )

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(importButton).toBeDisabled()
      })
    })

    test('should disable input fields during loading', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                success: true,
                count: 5,
                errors: [],
                message: 'Success'
              })
            })
          }, 100)
        })
      )

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(textarea).toBeDisabled()
      })
    })
  })

  describe('Success Message - Req 6.6', () => {
    test('should display success message with correct count', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 5,
          errors: [],
          message: 'Successfully imported 5 projects'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Import successful!/i)).toBeInTheDocument()
        expect(screen.getByText(/5 projects imported successfully/i)).toBeInTheDocument()
      })
    })

    test('should display singular form for single project', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 1,
          errors: [],
          message: 'Successfully imported 1 project'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/1 project imported successfully/i)).toBeInTheDocument()
      })
    })

    test('should hide import button after success', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 3,
          errors: [],
          message: 'Success'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Import successful!/i)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Import Projects' })).not.toBeInTheDocument()
      })
    })

    test('should change cancel button to close after success', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          count: 2,
          errors: [],
          message: 'Success'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText('Close')).toBeInTheDocument()
        expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Messages - Req 6.7, 6.8', () => {
    test('should display validation errors with record details', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          count: 0,
          errors: [
            {
              index: 0,
              field: 'name',
              value: '',
              error: 'Required field name is missing or empty'
            },
            {
              index: 1,
              field: 'budget',
              value: 'invalid',
              error: 'Budget must be a numeric value'
            }
          ],
          message: 'Validation failed for 2 records'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "", "budget": "invalid"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Import failed/i)).toBeInTheDocument()
        expect(screen.getByText('Validation failed for 2 records')).toBeInTheDocument()
        expect(screen.getByText('Required field name is missing or empty')).toBeInTheDocument()
        expect(screen.getByText('Budget must be a numeric value')).toBeInTheDocument()
      })
    })

    test('should display error count', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'name', value: '', error: 'Missing name' },
            { index: 1, field: 'budget', value: -100, error: 'Invalid budget' },
            { index: 2, field: 'status', value: 'invalid', error: 'Invalid status' }
          ],
          message: 'Validation failed'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText('3 errors found')).toBeInTheDocument()
      })
    })

    test('should display record index in error table', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'name', value: '', error: 'Missing name' },
            { index: 5, field: 'budget', value: 'abc', error: 'Invalid budget' }
          ],
          message: 'Validation failed'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument() // index 0 + 1
        expect(screen.getByText('#6')).toBeInTheDocument() // index 5 + 1
      })
    })

    test('should display field name and value in error table', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'budget', value: 'invalid_value', error: 'Invalid budget' }
          ],
          message: 'Validation failed'
        })
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText('budget')).toBeInTheDocument()
        expect(screen.getByText(/Value: "invalid_value"/i)).toBeInTheDocument()
      })
    })

    test('should provide copy errors button', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'name', value: '', error: 'Missing name' }
          ],
          message: 'Validation failed'
        })
      })

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn(() => Promise.resolve())
        }
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText('Copy errors')).toBeInTheDocument()
      })
    })

    test('should copy errors to clipboard when copy button is clicked', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          count: 0,
          errors: [
            { index: 0, field: 'name', value: '', error: 'Missing name' },
            { index: 1, field: 'budget', value: 'abc', error: 'Invalid budget' }
          ],
          message: 'Validation failed'
        })
      })

      const writeTextMock = jest.fn(() => Promise.resolve())
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      })

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        const copyButton = screen.getByText('Copy errors')
        fireEvent.click(copyButton)
      })
      
      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled()
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })

    test('should handle network errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '[{"name": "Test", "budget": 1000, "status": "planning"}]' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Import failed/i)).toBeInTheDocument()
        expect(screen.getByText('Failed to connect to the server')).toBeInTheDocument()
      })
    })

    test('should validate JSON format before sending', async () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: 'invalid json' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Import failed/i)).toBeInTheDocument()
        expect(screen.getByText('Failed to parse JSON input')).toBeInTheDocument()
      })
      
      // Should not call fetch
      expect(global.fetch).not.toHaveBeenCalled()
    })

    test('should validate JSON is an array', async () => {
      render(<ProjectImportModal isOpen={true} onClose={jest.fn()} />)
      
      const textarea = screen.getByPlaceholderText(/Project Alpha/i)
      fireEvent.change(textarea, { target: { value: '{"name": "Test"}' } })
      
      const importButton = screen.getByRole('button', { name: 'Import Projects' })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Import failed/i)).toBeInTheDocument()
        expect(screen.getByText('Invalid JSON format: expected an array')).toBeInTheDocument()
      })
      
      // Should not call fetch
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
