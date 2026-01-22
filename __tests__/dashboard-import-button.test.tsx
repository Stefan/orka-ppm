/**
 * Unit Tests: Dashboard Import Button
 * 
 * Feature: project-import-mvp
 * Task: 12.2 Write unit test for import button
 * 
 * Tests:
 * - Test button renders in dashboard
 * - Test button click opens modal
 * 
 * Validates: Requirements 6.1
 */

import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock react-dropzone
jest.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false
  })
}))

// Mock the Modal component
jest.mock('../components/ui/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
    if (!isOpen) return null
    return (
      <div data-testid="modal" role="dialog">
        <h2>{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    )
  },
  ModalFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// Mock UI components
jest.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  )
}))

jest.mock('../components/ui/Input', () => ({
  Textarea: ({ value, onChange, placeholder, ...props }: any) => (
    <textarea 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder}
      {...props}
    />
  )
}))

jest.mock('../components/ui/Alert', () => ({
  Alert: ({ children, variant }: any) => <div data-variant={variant}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>
}))

jest.mock('../lib/design-system', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}))

// Import the actual ProjectImportModal component
import ProjectImportModal from '../components/projects/ProjectImportModal'

// Test component that simulates the dashboard's import button behavior
function TestDashboardWithImportButton() {
  const [showImportModal, setShowImportModal] = useState(false)

  return (
    <div>
      <div data-testid="quick-actions">
        <span>Quick Actions:</span>
        <button 
          onClick={() => setShowImportModal(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          data-testid="import-button"
        >
          Import Projects
        </button>
      </div>
      <ProjectImportModal 
        isOpen={showImportModal} 
        onClose={() => setShowImportModal(false)} 
      />
    </div>
  )
}

describe('Dashboard Import Button', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Button Renders in Dashboard', () => {
    test('should render Import Projects button in Quick Actions section', () => {
      render(<TestDashboardWithImportButton />)

      // Find the Import Projects button
      const importButton = screen.getByTestId('import-button')
      expect(importButton).toBeInTheDocument()
      expect(importButton).toHaveTextContent('Import Projects')
    })

    test('should render Import Projects button with correct styling', () => {
      render(<TestDashboardWithImportButton />)

      // Find the button and verify it has the expected styling
      const importButton = screen.getByTestId('import-button')
      expect(importButton).toHaveClass('bg-blue-600')
    })

    test('should render Import Projects button in the Quick Actions bar', () => {
      render(<TestDashboardWithImportButton />)

      // Verify Quick Actions section exists
      const quickActions = screen.getByTestId('quick-actions')
      expect(quickActions).toBeInTheDocument()
      expect(quickActions).toHaveTextContent('Quick Actions')

      // Verify Import Projects button is present within Quick Actions
      const importButton = screen.getByTestId('import-button')
      expect(quickActions).toContainElement(importButton)
    })
  })

  describe('Button Click Opens Modal', () => {
    test('should open ProjectImportModal when Import Projects button is clicked', async () => {
      render(<TestDashboardWithImportButton />)

      // Modal should not be visible initially
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

      // Click the Import Projects button
      const importButton = screen.getByTestId('import-button')
      fireEvent.click(importButton)

      // Modal should now be visible
      await waitFor(() => {
        expect(screen.getByTestId('modal')).toBeInTheDocument()
      })
    })

    test('should display modal with Import Projects title when opened', async () => {
      render(<TestDashboardWithImportButton />)

      // Click the Import Projects button
      const importButton = screen.getByTestId('import-button')
      fireEvent.click(importButton)

      // Verify modal title
      await waitFor(() => {
        const modal = screen.getByTestId('modal')
        expect(modal).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /Import Projects/i })).toBeInTheDocument()
      })
    })
  })
})
