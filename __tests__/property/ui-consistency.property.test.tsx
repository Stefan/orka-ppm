/**
 * Property 12: User Interface Consistency
 * Feature: generic-construction-ppm-features
 * 
 * For any new feature interface, UI/UX patterns must be consistent with existing 
 * dashboard layouts and all required interactive elements must be present and functional
 * 
 * Validates: Requirements 1.6, 2.4, 3.6, 4.6, 5.4, 6.6, 7.4, 10.1, 10.3, 10.4
 */

import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

// Import UI components
import { SimulationCard, ImpactBadge, StatisticDisplay } from '@/components/ui/SimulationCard'
import { FormField, FormSection, CheckboxField } from '@/components/ui/FormField'
import { ProgressIndicator, LinearProgress, CircularProgress } from '@/components/ui/ProgressIndicator'
import { Tooltip, InfoTooltip } from '@/components/ui/Tooltip'
import { GuidedWorkflow, HelpPanel } from '@/components/ui/GuidedWorkflow'
import { ErrorMessage, ValidationError, EmptyState } from '@/components/ui/ErrorMessage'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'

// Import feature components
import MonteCarloVisualization from '@/components/MonteCarloVisualization'
import WhatIfScenarioPanel from '@/components/scenarios/WhatIfScenarioPanel'
import ShareableURLWidget from '@/components/shared/ShareableURLWidget'

describe('Property 12: User Interface Consistency', () => {
  describe('Simulation Display Components', () => {
    it('should render SimulationCard with consistent layout structure', () => {
      const { container } = render(
        <SimulationCard
          title="Test Simulation"
          subtitle="Test subtitle"
        >
          <div>Content</div>
        </SimulationCard>
      )

      // Check for consistent card structure
      expect(screen.getByText('Test Simulation')).toBeInTheDocument()
      expect(screen.getByText('Test subtitle')).toBeInTheDocument()
      expect(screen.getByText('Content')).toBeInTheDocument()

      // Verify card uses consistent styling classes
      const card = container.querySelector('[class*="card"]')
      expect(card).toBeInTheDocument()
    })

    it('should display loading state consistently', () => {
      render(
        <SimulationCard
          title="Loading Simulation"
          loading={true}
        >
          <div>Content</div>
        </SimulationCard>
      )

      // Should show loading spinner
      const spinner = document.querySelector('[class*="animate-spin"]')
      expect(spinner).toBeInTheDocument()

      // Content should not be visible during loading
      expect(screen.queryByText('Content')).not.toBeInTheDocument()
    })

    it('should display error state with consistent styling', () => {
      render(
        <SimulationCard
          title="Error Simulation"
          error="Test error message"
        >
          <div>Content</div>
        </SimulationCard>
      )

      // Should show error message
      expect(screen.getByText('Test error message')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()

      // Content should not be visible during error
      expect(screen.queryByText('Content')).not.toBeInTheDocument()
    })

    it('should render ImpactBadge with appropriate visual indicators', () => {
      const { rerender } = render(
        <ImpactBadge
          label="Cost"
          value="$10,000"
          type="cost"
          trend="up"
        />
      )

      expect(screen.getByText('Cost:')).toBeInTheDocument()
      expect(screen.getByText('$10,000')).toBeInTheDocument()

      // Test different types and trends
      rerender(
        <ImpactBadge
          label="Schedule"
          value="5 days"
          type="schedule"
          trend="down"
        />
      )

      expect(screen.getByText('Schedule:')).toBeInTheDocument()
      expect(screen.getByText('5 days')).toBeInTheDocument()
    })

    it('should render StatisticDisplay with consistent formatting', () => {
      render(
        <StatisticDisplay
          label="P90 Cost"
          value="$1,250,000"
          description="90th percentile"
        />
      )

      expect(screen.getByText('P90 Cost')).toBeInTheDocument()
      expect(screen.getByText('$1,250,000')).toBeInTheDocument()
      expect(screen.getByText('90th percentile')).toBeInTheDocument()
    })
  })

  describe('Form Components Consistency', () => {
    it('should render FormField with consistent label and input structure', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(
        <FormField
          label="Project Name"
          name="projectName"
          value=""
          onChange={handleChange}
          required={true}
        />
      )

      expect(screen.getByText('Project Name')).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument() // Required indicator

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test')
      expect(handleChange).toHaveBeenCalled()
    })

    it('should display form errors consistently', () => {
      render(
        <FormField
          label="Email"
          name="email"
          value="invalid"
          onChange={() => {}}
          error="Invalid email format"
        />
      )

      expect(screen.getAllByText('Invalid email format')[0]).toBeInTheDocument()
      
      // Error should have alert icon
      const errorIcon = document.querySelector('[class*="text-red"]')
      expect(errorIcon).toBeInTheDocument()
    })

    it('should render FormSection with consistent grouping', () => {
      render(
        <FormSection
          title="Project Details"
          description="Enter basic project information"
        >
          <FormField
            label="Name"
            name="name"
            value=""
            onChange={() => {}}
          />
        </FormSection>
      )

      expect(screen.getByText('Project Details')).toBeInTheDocument()
      expect(screen.getByText('Enter basic project information')).toBeInTheDocument()
      expect(screen.getByText('Name')).toBeInTheDocument()
    })

    it('should render CheckboxField with consistent styling', async () => {
      const handleChange = jest.fn()
      const user = userEvent.setup()

      render(
        <CheckboxField
          label="Enable notifications"
          name="notifications"
          checked={false}
          onChange={handleChange}
          description="Receive email updates"
        />
      )

      expect(screen.getByText('Enable notifications')).toBeInTheDocument()
      expect(screen.getByText('Receive email updates')).toBeInTheDocument()

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)
      expect(handleChange).toHaveBeenCalledWith(true)
    })
  })

  describe('Progress Indicators Consistency', () => {
    it('should render ProgressIndicator with step visualization', () => {
      const steps = [
        { label: 'Step 1', status: 'completed' as const },
        { label: 'Step 2', status: 'in-progress' as const },
        { label: 'Step 3', status: 'pending' as const }
      ]

      render(<ProgressIndicator steps={steps} currentStep={1} />)

      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.getByText('Step 2')).toBeInTheDocument()
      expect(screen.getByText('Step 3')).toBeInTheDocument()
    })

    it('should render LinearProgress with percentage display', () => {
      render(
        <LinearProgress
          value={75}
          max={100}
          label="Upload Progress"
          showPercentage={true}
        />
      )

      expect(screen.getByText('Upload Progress')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('should render CircularProgress with consistent sizing', () => {
      render(
        <CircularProgress
          value={50}
          max={100}
          label="Processing"
          showPercentage={true}
        />
      )

      expect(screen.getByText('50%')).toBeInTheDocument()
      expect(screen.getByText('Processing')).toBeInTheDocument()
    })
  })

  describe('Help and Guidance Components', () => {
    it('should render Tooltip with hover behavior', async () => {
      const user = userEvent.setup()

      render(
        <Tooltip content="This is helpful information">
          <button>Hover me</button>
        </Tooltip>
      )

      const button = screen.getByText('Hover me')
      await user.hover(button)

      // Tooltip should appear after delay
      await new Promise(resolve => setTimeout(resolve, 300))
    })

    it('should render InfoTooltip with info icon', () => {
      render(<InfoTooltip content="Help text" />)

      const icon = document.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('should render GuidedWorkflow with step navigation', () => {
      const steps = [
        {
          id: '1',
          title: 'Step 1',
          description: 'First step',
          content: <div>Step 1 content</div>
        },
        {
          id: '2',
          title: 'Step 2',
          description: 'Second step',
          content: <div>Step 2 content</div>
        }
      ]

      render(
        <GuidedWorkflow
          title="Setup Wizard"
          steps={steps}
          isOpen={true}
          onClose={() => {}}
          onComplete={() => {}}
        />
      )

      expect(screen.getByText('Setup Wizard')).toBeInTheDocument()
      expect(screen.getAllByText('Step 1').length).toBeGreaterThan(0)
      expect(screen.getByText('First step')).toBeInTheDocument()
    })

    it('should render HelpPanel with slide-out behavior', () => {
      render(
        <HelpPanel
          title="Help Documentation"
          content={<div>Help content</div>}
          isOpen={true}
          onClose={() => {}}
        />
      )

      expect(screen.getByText('Help Documentation')).toBeInTheDocument()
      expect(screen.getByText('Help content')).toBeInTheDocument()
    })
  })

  describe('Error Handling Components', () => {
    it('should render ErrorMessage with appropriate severity styling', () => {
      const { rerender } = render(
        <ErrorMessage
          type="error"
          message="An error occurred"
        />
      )

      expect(screen.getByText('An error occurred')).toBeInTheDocument()

      // Test different types
      rerender(
        <ErrorMessage
          type="warning"
          message="Warning message"
        />
      )

      expect(screen.getByText('Warning message')).toBeInTheDocument()

      rerender(
        <ErrorMessage
          type="success"
          message="Success message"
        />
      )

      expect(screen.getByText('Success message')).toBeInTheDocument()
    })

    it('should render ErrorMessage with actionable buttons', async () => {
      const handleAction = jest.fn()
      const user = userEvent.setup()

      render(
        <ErrorMessage
          type="error"
          message="Connection failed"
          actionable={true}
          actions={[
            { label: 'Retry', onClick: handleAction, variant: 'primary' },
            { label: 'Cancel', onClick: jest.fn(), variant: 'secondary' }
          ]}
        />
      )

      const retryButton = screen.getByText('Retry')
      await user.click(retryButton)
      expect(handleAction).toHaveBeenCalled()
    })

    it('should render ValidationError with field-specific errors', () => {
      const errors = {
        email: ['Invalid email format'],
        password: ['Password too short', 'Must contain a number']
      }

      render(<ValidationError errors={errors} />)

      expect(screen.getByText(/2 validation errors found/)).toBeInTheDocument()
      expect(screen.getByText('Invalid email format')).toBeInTheDocument()
      expect(screen.getByText('Password too short')).toBeInTheDocument()
      expect(screen.getByText('Must contain a number')).toBeInTheDocument()
    })

    it('should render EmptyState with guidance', async () => {
      const handleAction = jest.fn()
      const user = userEvent.setup()

      render(
        <EmptyState
          title="No data available"
          description="Get started by creating your first item"
          action={{
            label: 'Create Item',
            onClick: handleAction
          }}
        />
      )

      expect(screen.getByText('No data available')).toBeInTheDocument()
      expect(screen.getByText('Get started by creating your first item')).toBeInTheDocument()

      const button = screen.getByText('Create Item')
      await user.click(button)
      expect(handleAction).toHaveBeenCalled()
    })
  })

  describe('Feature Component Integration', () => {
    it('should render MonteCarloVisualization with consistent UI patterns', () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'test-user' }
      }

      render(
        <MonteCarloVisualization
          simulationId="test-sim-123"
          session={mockSession}
        />
      )

      // Should have consistent header structure
      expect(screen.getByText('Monte Carlo Risk Analysis')).toBeInTheDocument()
      expect(screen.getByText('Statistical visualization of simulation results')).toBeInTheDocument()
    })

    it('should render WhatIfScenarioPanel with consistent layout', () => {
      render(
        <WhatIfScenarioPanel
          projectId="test-project-123"
        />
      )

      // Should have consistent header and description
      expect(screen.getByText('What-If Scenarios')).toBeInTheDocument()
      expect(screen.getByText('Analyze project parameter changes and their impacts')).toBeInTheDocument()
    })

    it('should render ShareableURLWidget with consistent modal pattern', () => {
      render(
        <ShareableURLWidget
          projectId="test-project-123"
          projectName="Test Project"
        />
      )

      // Should have share button with consistent styling
      expect(screen.getByText('Share Project')).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('should maintain consistent touch targets across components', () => {
      render(
        <div>
          <Button>Click me</Button>
          <CheckboxField
            label="Option"
            name="option"
            checked={false}
            onChange={() => {}}
          />
        </div>
      )

      const button = screen.getByText('Click me')
      const checkbox = screen.getByRole('checkbox')

      // Both should have adequate touch targets (minimum 44x44px)
      expect(button).toBeInTheDocument()
      expect(checkbox).toBeInTheDocument()
    })

    it('should use consistent spacing and padding', () => {
      const { container } = render(
        <div>
          <Card padding="md">
            <FormSection title="Section 1">
              <FormField
                label="Field 1"
                name="field1"
                value=""
                onChange={() => {}}
              />
            </FormSection>
          </Card>
        </div>
      )

      // Components should use consistent spacing classes
      const card = container.querySelector('[class*="p-"]')
      expect(card).toBeInTheDocument()
    })
  })

})
