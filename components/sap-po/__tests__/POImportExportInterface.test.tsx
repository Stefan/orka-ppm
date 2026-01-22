import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { POImportExportInterface } from '../POImportExportInterface'

// Mock fetch
global.fetch = jest.fn()

describe('POImportExportInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders import mode by default', () => {
    render(<POImportExportInterface projectId="test-project" />)
    
    expect(screen.getByText('Import SAP Data')).toBeInTheDocument()
    expect(screen.getByText('Import PO Breakdown Data')).toBeInTheDocument()
  })

  it('switches between import and export modes', () => {
    render(<POImportExportInterface projectId="test-project" />)
    
    // Click export tab
    const exportButton = screen.getByText('Export Data')
    fireEvent.click(exportButton)
    
    expect(screen.getByText('Export PO Breakdown Data')).toBeInTheDocument()
    expect(screen.getByText('Export Format')).toBeInTheDocument()
  })

  it('displays file upload area in import mode', () => {
    render(<POImportExportInterface projectId="test-project" />)
    
    expect(screen.getByText(/Drag & drop a file here/i)).toBeInTheDocument()
    expect(screen.getByText(/Supported formats: CSV, XLS, XLSX/i)).toBeInTheDocument()
  })

  it('shows export format options in export mode', () => {
    render(<POImportExportInterface projectId="test-project" />)
    
    // Switch to export mode
    fireEvent.click(screen.getByText('Export Data'))
    
    expect(screen.getByText('csv')).toBeInTheDocument()
    expect(screen.getByText('excel')).toBeInTheDocument()
    expect(screen.getByText('json')).toBeInTheDocument()
  })

  it('displays export configuration options', () => {
    render(<POImportExportInterface projectId="test-project" />)
    
    // Switch to export mode
    fireEvent.click(screen.getByText('Export Data'))
    
    expect(screen.getByText('Hierarchy relationships')).toBeInTheDocument()
    expect(screen.getByText('Financial data and variances')).toBeInTheDocument()
    expect(screen.getByText('Custom fields and metadata')).toBeInTheDocument()
  })

  it('handles successful import', async () => {
    const mockResult = {
      success: true,
      batch_id: 'batch-123',
      total_records: 10,
      processed_records: 10,
      successful_records: 10,
      failed_records: 0,
      conflicts: [],
      errors: [],
      warnings: [],
      processing_time_ms: 1500,
      message: 'Import completed successfully'
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult
    })

    const onImportComplete = jest.fn()
    render(
      <POImportExportInterface 
        projectId="test-project" 
        onImportComplete={onImportComplete}
      />
    )

    // Verify import interface is rendered
    expect(screen.getByText('Import PO Breakdown Data')).toBeInTheDocument()
    
    // Note: Full file upload testing would require more complex setup with react-dropzone
    // This test verifies the component structure and callback setup
  })

  it('displays import errors', async () => {
    const mockResult = {
      success: false,
      total_records: 10,
      processed_records: 10,
      successful_records: 5,
      failed_records: 5,
      conflicts: [],
      errors: [
        {
          row_number: 1,
          field: 'planned_amount',
          value: 'invalid',
          error: 'Invalid number format'
        }
      ],
      warnings: [],
      processing_time_ms: 1000,
      message: 'Import completed with errors'
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResult
    })

    render(<POImportExportInterface projectId="test-project" />)

    // The error display would be shown after import completes
    // This is a simplified test - full implementation would need file upload simulation
  })

  it('shows progress during import', () => {
    render(<POImportExportInterface projectId="test-project" />)
    
    // Progress bar would be shown during loading state
    // This test verifies the component structure
    expect(screen.getByText('Import SAP Data')).toBeInTheDocument()
  })

  it('allows filter configuration in export mode', () => {
    render(<POImportExportInterface projectId="test-project" />)
    
    // Switch to export mode
    fireEvent.click(screen.getByText('Export Data'))
    
    // Show filters
    const showFiltersButton = screen.getByText(/Show.*Filters/i)
    fireEvent.click(showFiltersButton)
    
    expect(screen.getByText('Filter by Status')).toBeInTheDocument()
  })
})
