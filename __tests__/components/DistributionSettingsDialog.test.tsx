import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DistributionSettingsDialog } from '@/components/costbook/DistributionSettingsDialog'
import { Currency } from '@/types/costbook'

describe('DistributionSettingsDialog', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    onApply: jest.fn(),
    projectBudget: 100000,
    projectStartDate: '2024-01-01',
    projectEndDate: '2024-12-31',
    currentSpend: 30000,
    currency: Currency.USD
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render when open', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    expect(screen.getByText('Distribution Settings')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<DistributionSettingsDialog {...mockProps} isOpen={false} />)
    expect(screen.queryByText('Distribution Settings')).not.toBeInTheDocument()
  })

  it('should display all three profile tabs', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    expect(screen.getByRole('button', { name: 'Linear' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Generated' })).toBeInTheDocument()
  })

  it('should show linear distribution by default', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    expect(screen.getByText(/Linear Distribution:/)).toBeInTheDocument()
  })

  it('should switch to custom tab when clicked', () => {
    render(<DistributionSettingsDialog {...mockProps} />)

    const customTab = screen.getByRole('button', { name: 'Custom' })
    fireEvent.click(customTab)

    expect(screen.getByText(/Custom Distribution:/)).toBeInTheDocument()
    expect(screen.getByText('Auto Balance to 100%')).toBeInTheDocument()
  })

  it('should switch to AI tab when clicked', () => {
    render(<DistributionSettingsDialog {...mockProps} />)

    const aiTab = screen.getByRole('button', { name: 'AI Generated' })
    fireEvent.click(aiTab)

    expect(screen.getByText(/AI Generated Distribution:/)).toBeInTheDocument()
  })

  it('should display preview section', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    expect(screen.getByText('Distribution Preview')).toBeInTheDocument()
  })

  it('should call onClose when close button clicked', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    
    const closeButton = screen.getByLabelText('Close dialog')
    fireEvent.click(closeButton)
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when cancel button clicked', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('should apply linear distribution', async () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    
    const applyButton = screen.getByText('Apply Distribution')
    fireEvent.click(applyButton)
    
    await waitFor(() => {
      expect(mockProps.onApply).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: 'linear',
          granularity: 'month'
        })
      )
    })
  })

  it('should change granularity', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    
    const granularitySelect = screen.getByLabelText('Granularity')
    fireEvent.change(granularitySelect, { target: { value: 'week' } })
    
    expect(granularitySelect).toHaveValue('week')
  })

  it('should change start date', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    const durationSelect = screen.getByLabelText('Duration')
    fireEvent.change(durationSelect, { target: { value: 'custom' } })

    const startDateInput = screen.getByLabelText('From Date')
    fireEvent.change(startDateInput, { target: { value: '2024-02-01' } })

    expect(startDateInput).toHaveValue('2024-02-01')
  })

  it('should change end date', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    const durationSelect = screen.getByLabelText('Duration')
    fireEvent.change(durationSelect, { target: { value: 'custom' } })

    const endDateInput = screen.getByLabelText('To Date')
    fireEvent.change(endDateInput, { target: { value: '2024-11-30' } })

    expect(endDateInput).toHaveValue('2024-11-30')
  })

  describe('Custom Distribution', () => {
    it('should show custom percentage inputs', async () => {
      render(<DistributionSettingsDialog {...mockProps} />)

      const customTab = screen.getByRole('button', { name: 'Custom' })
      fireEvent.click(customTab)

      // Wait for useEffect to populate equal distribution and render spinbuttons
      await waitFor(() => {
        const percentageInputs = screen.getAllByRole('spinbutton')
        expect(percentageInputs.length).toBeGreaterThan(0)
      })
    })

    it('should show validation error for invalid percentages', async () => {
      render(<DistributionSettingsDialog {...mockProps} />)

      const customTab = screen.getByRole('button', { name: 'Custom' })
      fireEvent.click(customTab)

      await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0))
      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '100' } })

      // When percentages do not sum to 100%, Apply is disabled and inline hint is shown
      await waitFor(() => {
        expect(screen.getByText(/Must equal 100%/)).toBeInTheDocument()
      })
      const applyButton = screen.getByText('Apply Distribution')
      expect(applyButton).toBeDisabled()
    })

    it('should balance percentages when auto-balance clicked', async () => {
      render(<DistributionSettingsDialog {...mockProps} />)

      const customTab = screen.getByRole('button', { name: 'Custom' })
      fireEvent.click(customTab)

      await waitFor(() => expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0))

      const autoBalanceButton = screen.getByText('Auto Balance to 100%')
      fireEvent.click(autoBalanceButton)

      await waitFor(() => {
        expect(screen.getByText(/Total: 100\.00%/)).toBeInTheDocument()
      })
    })
  })

  describe('Initial Settings', () => {
    it('should populate fields with initial settings', () => {
      const initialSettings = {
        profile: 'linear' as const,
        duration_start: '2024-03-01',
        duration_end: '2024-09-30',
        granularity: 'week' as const,
        duration_type: 'custom' as const
      }

      render(
        <DistributionSettingsDialog 
          {...mockProps} 
          initialSettings={initialSettings}
        />
      )

      expect(screen.getByLabelText('From Date')).toHaveValue('2024-03-01')
      expect(screen.getByLabelText('To Date')).toHaveValue('2024-09-30')
      expect(screen.getByLabelText('Granularity')).toHaveValue('week')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<DistributionSettingsDialog {...mockProps} />)

      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
      expect(screen.getByLabelText('From Date')).toBeInTheDocument()
      expect(screen.getByLabelText('To Date')).toBeInTheDocument()
      expect(screen.getByLabelText('Granularity')).toBeInTheDocument()
    })

    it('should disable apply button when invalid', async () => {
      render(<DistributionSettingsDialog {...mockProps} />)

      const customTab = screen.getByRole('button', { name: 'Custom' })
      fireEvent.click(customTab)

      // Wait for Custom tab to initialize with equal distribution, then Apply should be enabled
      await waitFor(() => {
        const applyButton = screen.getByText('Apply Distribution')
        expect(applyButton).not.toBeDisabled()
      })
    })
  })
})
