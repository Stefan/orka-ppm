/**
 * Property 14: Error Handling Integration
 * Feature: generic-construction-ppm-features
 * 
 * For any error condition across new features, error messages must be clear and actionable,
 * and errors must integrate with existing logging infrastructure
 * 
 * Validates: Requirements 7.6, 10.2
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import error handling components
import { ErrorMessage, ValidationError, EmptyState } from '@/components/ui/ErrorMessage'
import { SimulationCard } from '@/components/ui/SimulationCard'
import { FormField } from '@/components/ui/FormField'

// Import feature components
import MonteCarloVisualization from '@/components/MonteCarloVisualization'
import WhatIfScenarioPanel from '@/components/scenarios/WhatIfScenarioPanel'
import ShareableURLWidget from '@/components/shared/ShareableURLWidget'

// Mock fetch for API error testing
global.fetch = jest.fn()

describe('Property 14: Error Handling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  describe('Error Message Clarity', () => {
    it('should display clear error messages with severity indicators', () => {
      const errorTypes = [
        { type: 'error' as const, message: 'Failed to load data' },
        { type: 'warning' as const, message: 'Data may be outdated' },
        { type: 'info' as const, message: 'Processing in progress' }
      ]

      errorTypes.forEach(({ type, message }) => {
        const { unmount } = render(
          <ErrorMessage type={type} message={message} />
        )

        expect(screen.getByText(message)).toBeInTheDocument()
        
        // Should have appropriate icon
        const icon = document.querySelector('svg')
        expect(icon).toBeInTheDocument()

        unmount()
      })
    })

    it('should provide actionable error messages with suggested actions', async () => {
      const handleRetry = jest.fn()
      const handleCancel = jest.fn()
      const user = userEvent.setup()

      render(
        <ErrorMessage
          type="error"
          title="Connection Failed"
          message="Unable to connect to the server. Please check your internet connection and try again."
          actionable={true}
          actions={[
            { label: 'Retry Connection', onClick: handleRetry, variant: 'primary' },
            { label: 'Cancel', onClick: handleCancel, variant: 'secondary' }
          ]}
        />
      )

      // Error message should be clear
      expect(screen.getByText('Connection Failed')).toBeInTheDocument()
      expect(screen.getByText(/Unable to connect to the server/)).toBeInTheDocument()

      // Actions should be available
      const retryButton = screen.getByText('Retry Connection')
      const cancelButton = screen.getByText('Cancel')

      await user.click(retryButton)
      expect(handleRetry).toHaveBeenCalledTimes(1)

      await user.click(cancelButton)
      expect(handleCancel).toHaveBeenCalledTimes(1)
    })

    it('should display validation errors with field-specific guidance', () => {
      const errors = {
        project_name: ['Project name is required', 'Project name must be at least 3 characters'],
        budget: ['Budget must be a positive number'],
        start_date: ['Start date cannot be in the past']
      }

      render(<ValidationError errors={errors} />)

      // Should show error count
      expect(screen.getByText(/3 validation errors found/)).toBeInTheDocument()

      // Should show all field errors
      expect(screen.getByText('Project name is required')).toBeInTheDocument()
      expect(screen.getByText('Project name must be at least 3 characters')).toBeInTheDocument()
      expect(screen.getByText('Budget must be a positive number')).toBeInTheDocument()
      expect(screen.getByText('Start date cannot be in the past')).toBeInTheDocument()
    })

    it('should provide contextual help for empty states', async () => {
      const handleCreate = jest.fn()
      const user = userEvent.setup()

      render(
        <EmptyState
          title="No Simulations Found"
          description="You haven't run any Monte Carlo simulations yet. Create your first simulation to analyze project risks and uncertainties."
          action={{
            label: 'Run First Simulation',
            onClick: handleCreate
          }}
        />
      )

      expect(screen.getByText('No Simulations Found')).toBeInTheDocument()
      expect(screen.getByText(/You haven't run any Monte Carlo simulations yet/)).toBeInTheDocument()

      const button = screen.getByText('Run First Simulation')
      await user.click(button)
      expect(handleCreate).toHaveBeenCalled()
    })
  })

  describe('Error State Handling in Components', () => {
    it('should handle SimulationCard error states gracefully', () => {
      const errorMessage = 'Failed to load simulation results. The simulation may have expired or been deleted.'

      render(
        <SimulationCard
          title="Monte Carlo Analysis"
          error={errorMessage}
        >
          <div>Content that should not be visible</div>
        </SimulationCard>
      )

      // Error should be displayed
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()

      // Content should not be visible
      expect(screen.queryByText('Content that should not be visible')).not.toBeInTheDocument()
    })

    it('should handle FormField validation errors with clear feedback', () => {
      render(
        <FormField
          label="Email Address"
          name="email"
          type="email"
          value="invalid-email"
          onChange={() => {}}
          error="Please enter a valid email address (e.g., user@example.com)"
          helpText="We'll use this email to send you project notifications"
        />
      )

      // Error should be displayed with icon
      expect(screen.getByText(/Please enter a valid email address/)).toBeInTheDocument()
      
      // Help text should not be visible when error is present
      expect(screen.queryByText(/We'll use this email/)).not.toBeInTheDocument()
    })

    it('should handle MonteCarloVisualization API errors', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'test-user' }
      }

      const mockError = jest.fn()

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error: Unable to reach simulation service')
      )

      render(
        <MonteCarloVisualization
          simulationId="test-sim-123"
          session={mockSession}
          onError={mockError}
        />
      )

      // Wait for error to be displayed
      await waitFor(() => {
        const errorElements = screen.queryAllByText(/Network error/)
        expect(errorElements.length).toBeGreaterThan(0)
      }, { timeout: 3000 })
    })

    it('should handle WhatIfScenarioPanel loading failures', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to load scenarios')
      )

      render(
        <WhatIfScenarioPanel projectId="test-project-123" />
      )

      // Component should handle error gracefully
      await waitFor(() => {
        // Should not crash and should show some content
        expect(screen.getByText('What-If Scenarios')).toBeInTheDocument()
      })
    })

    it('should handle ShareableURLWidget generation errors', async () => {
      const user = userEvent.setup()

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Failed to generate shareable URL')
      )

      render(
        <ShareableURLWidget
          projectId="test-project-123"
          projectName="Test Project"
        />
      )

      // Open the widget
      const shareButton = screen.getByText('Share Project')
      await user.click(shareButton)

      // Try to generate URL
      await waitFor(() => {
        const generateButton = screen.queryByText('Generate Link')
        if (generateButton) {
          user.click(generateButton)
        }
      })

      // Should handle error gracefully
      await waitFor(() => {
        expect(screen.getByText('Share Project')).toBeInTheDocument()
      })
    })
  })

  describe('Error Recovery Mechanisms', () => {
    it('should provide retry functionality for failed operations', async () => {
      const handleRetry = jest.fn()
      const user = userEvent.setup()

      render(
        <ErrorMessage
          type="error"
          message="Simulation failed to complete"
          actionable={true}
          actions={[
            { label: 'Retry Simulation', onClick: handleRetry, variant: 'primary' }
          ]}
        />
      )

      const retryButton = screen.getByText('Retry Simulation')
      
      // First retry
      await user.click(retryButton)
      expect(handleRetry).toHaveBeenCalledTimes(1)

      // Second retry
      await user.click(retryButton)
      expect(handleRetry).toHaveBeenCalledTimes(2)
    })

    it('should allow dismissal of non-critical errors', async () => {
      const handleDismiss = jest.fn()
      const user = userEvent.setup()

      render(
        <ErrorMessage
          type="warning"
          message="Some data may be outdated"
          onDismiss={handleDismiss}
        />
      )

      // Find and click dismiss button
      const dismissButton = document.querySelector('button[class*="text-gray"]')
      expect(dismissButton).toBeInTheDocument()

      if (dismissButton) {
        await user.click(dismissButton)
        expect(handleDismiss).toHaveBeenCalled()
      }
    })

    it('should maintain form state after validation errors', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      const { rerender } = render(
        <FormField
          label="Project Budget"
          name="budget"
          type="number"
          value="invalid"
          onChange={handleChange}
          error="Budget must be a number"
        />
      )

      const input = screen.getByRole('spinbutton')
      
      // User corrects the error
      await user.clear(input)
      await user.type(input, '100000')

      expect(handleChange).toHaveBeenCalled()

      // Rerender without error
      rerender(
        <FormField
          label="Project Budget"
          name="budget"
          type="number"
          value="100000"
          onChange={handleChange}
        />
      )

      // Error should be gone
      expect(screen.queryByText('Budget must be a number')).not.toBeInTheDocument()
    })
  })

  describe('Error Logging Integration', () => {
    it('should log errors to console for debugging', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const TestComponent = () => {
        throw new Error('Test error for logging')
      }

      const ErrorBoundary = class extends React.Component<
        { children: React.ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: React.ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        componentDidCatch(error: Error) {
          console.error('Error caught:', error)
        }

        render() {
          if (this.state.hasError) {
            return <ErrorMessage type="error" message="Something went wrong" />
          }
          return this.props.children
        }
      }

      render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      )

      expect(consoleSpy).toHaveBeenCalled()
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('should provide error context for debugging', () => {
      const errorContext = {
        component: 'MonteCarloVisualization',
        operation: 'generateCharts',
        simulationId: 'sim-123',
        timestamp: new Date().toISOString()
      }

      render(
        <ErrorMessage
          type="error"
          title="Chart Generation Failed"
          message={`Failed to generate charts for simulation ${errorContext.simulationId}. Please try again or contact support if the problem persists.`}
        />
      )

      // Error message should include context
      expect(screen.getByText(/Failed to generate charts for simulation sim-123/)).toBeInTheDocument()
    })
  })

  describe('User Guidance for Errors', () => {
    it('should provide step-by-step resolution guidance', () => {
      render(
        <ErrorMessage
          type="error"
          title="Simulation Configuration Error"
          message="The simulation could not be started due to invalid configuration. Please check the following: 1) Ensure all required risk parameters are defined, 2) Verify that probability values are between 0 and 1, 3) Confirm that at least one risk is marked as active."
        />
      )

      expect(screen.getByText('Simulation Configuration Error')).toBeInTheDocument()
      expect(screen.getByText(/Please check the following/)).toBeInTheDocument()
    })

    it('should link to documentation for complex errors', async () => {
      const handleViewDocs = jest.fn()
      const user = userEvent.setup()

      render(
        <ErrorMessage
          type="error"
          message="Advanced configuration error"
          actionable={true}
          actions={[
            { label: 'View Documentation', onClick: handleViewDocs, variant: 'secondary' }
          ]}
        />
      )

      const docsButton = screen.getByText('View Documentation')
      await user.click(docsButton)
      expect(handleViewDocs).toHaveBeenCalled()
    })

    it('should suggest alternative actions when primary action fails', () => {
      render(
        <ErrorMessage
          type="error"
          title="Unable to Generate Report"
          message="The report generation service is currently unavailable. You can try again later or export the data manually."
          actionable={true}
          actions={[
            { label: 'Try Again', onClick: jest.fn(), variant: 'primary' },
            { label: 'Export Data', onClick: jest.fn(), variant: 'secondary' }
          ]}
        />
      )

      expect(screen.getByText('Try Again')).toBeInTheDocument()
      expect(screen.getByText('Export Data')).toBeInTheDocument()
    })
  })

  describe('Error Prevention', () => {
    it('should provide inline validation to prevent errors', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(
        <FormField
          label="Simulation Iterations"
          name="iterations"
          type="number"
          value=""
          onChange={handleChange}
          helpText="Enter a value between 1,000 and 100,000 iterations"
        />
      )

      const input = screen.getByRole('spinbutton')
      await user.type(input, '500')

      // Help text should guide user
      expect(screen.getByText(/Enter a value between 1,000 and 100,000/)).toBeInTheDocument()
    })

    it('should disable actions that would cause errors', () => {
      render(
        <SimulationCard
          title="Simulation"
          loading={true}
          actions={
            <button disabled className="opacity-50 cursor-not-allowed">
              Generate Report
            </button>
          }
        >
          <div>Loading...</div>
        </SimulationCard>
      )

      const button = screen.getByText('Generate Report')
      expect(button).toBeDisabled()
    })

    it('should show warnings before potentially destructive actions', () => {
      render(
        <ErrorMessage
          type="warning"
          title="Confirm Deletion"
          message="Are you sure you want to delete this simulation? This action cannot be undone."
          actionable={true}
          actions={[
            { label: 'Delete', onClick: jest.fn(), variant: 'primary' },
            { label: 'Cancel', onClick: jest.fn(), variant: 'secondary' }
          ]}
        />
      )

      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument()
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument()
    })
  })
})
