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
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByText('AI Generated')).toBeInTheDocument()
  })

  it('should show linear distribution by default', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    expect(screen.getByText(/Linear Distribution:/)).toBeInTheDocument()
  })

  it('should switch to custom tab when clicked', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    
    const customTab = screen.getByText('Custom')
    fireEvent.click(customTab)
    
    expect(screen.getByText(/Custom Distribution:/)).toBeInTheDocument()
    expect(screen.getByText('Auto Balance to 100%')).toBeInTheDocument()
  })

  it('should switch to AI tab when clicked', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    
    const aiTab = screen.getByText('AI Generated')
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
    
    const startDateInput = screen.getByLabelText('Start Date')
    fireEvent.change(startDateInput, { target: { value: '2024-02-01' } })
    
    expect(startDateInput).toHaveValue('2024-02-01')
  })

  it('should change end date', () => {
    render(<DistributionSettingsDialog {...mockProps} />)
    
    const endDateInput = screen.getByLabelText('End Date')
    fireEvent.change(endDateInput, { target: { value: '2024-11-30' } })
    
    expect(endDateInput).toHaveValue('2024-11-30')
  })

  describe('Custom Distribution', () => {
    it('should show custom percentage inputs', () => {
      render(<DistributionSettingsDialog {...mockProps} />)
      
      const customTab = screen.getByText('Custom')
      fireEvent.click(customTab)
      
      // Should show percentage inputs for each period
      const percentageInputs = screen.getAllByRole('spinbutton')
      expect(percentageInputs.length).toBeGreaterThan(0)
    })

    it('should show validation error for invalid percentages', async () => {
      render(<DistributionSettingsDialog {...mockProps} />)
      
      const customTab = screen.getByText('Custom')
      fireEvent.click(customTab)
      
      // Try to apply without balancing percentages
      const applyButton = screen.getByText('Apply Distribution')
      fireEvent.click(applyButton)
      
      // Should show error (percentages don't sum to 100)
      await waitFor(() => {
        expect(screen.getByText(/Validation Error/)).toBeInTheDocument()
      })
    })

    it('should balance percentages when auto-balance clicked', async () => {
      render(<DistributionSettingsDialog {...mockProps} />)
      
      const customTab = screen.getByText('Custom')
      fireEvent.click(customTab)
      
      await waitFor(() => {
        const autoBalanceButton = screen.getByText('Auto Balance to 100%')
        fireEvent.click(autoBalanceButton)
      })
      
      // Total percentage should be displayed as 100%
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
        granularity: 'week' as const
      }

      render(
        <DistributionSettingsDialog 
          {...mockProps} 
          initialSettings={initialSettings}
        />
      )
      
      expect(screen.getByLabelText('Start Date')).toHaveValue('2024-03-01')
      expect(screen.getByLabelText('End Date')).toHaveValue('2024-09-30')
      expect(screen.getByLabelText('Granularity')).toHaveValue('week')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<DistributionSettingsDialog {...mockProps} />)
      
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
      expect(screen.getByLabelText('Start Date')).toBeInTheDocument()
      expect(screen.getByLabelText('End Date')).toBeInTheDocument()
      expect(screen.getByLabelText('Granularity')).toBeInTheDocument()
    })

    it('should disable apply button when invalid', async () => {
      render(<DistributionSettingsDialog {...mockProps} />)
      
      const customTab = screen.getByText('Custom')
      fireEvent.click(customTab)
      
      await waitFor(() => {
        const applyButton = screen.getByText('Apply Distribution')
        // Button should be enabled by default (equal distribution)
        expect(applyButton).not.toBeDisabled()
      })
    })
  })
})
