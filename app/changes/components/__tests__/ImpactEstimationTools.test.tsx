
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImpactEstimationTools from '../ImpactEstimationTools'

const mockOnEstimateUpdate = jest.fn()
const mockOnSaveTemplate = jest.fn()

const defaultProps = {
  changeId: 'test-change-1',
  changeType: 'design',
  projectValue: 1000000,
  onEstimateUpdate: mockOnEstimateUpdate,
  onSaveTemplate: mockOnSaveTemplate
}

const mockCurrentEstimate = {
  cost_impact: 25000,
  schedule_impact_days: 14,
  resource_impact: {
    additional_resources: 5000,
    reallocation_cost: 2000
  },
  risk_impact: {
    new_risks_count: 2,
    risk_mitigation_cost: 3000
  },
  confidence_level: 0.75
}

describe('ImpactEstimationTools', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders header with correct title and actions', () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    expect(screen.getByText('Impact Estimation Tools')).toBeInTheDocument()
    expect(screen.getByText(/Interactive tools for estimating change impact/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save estimate/i })).toBeInTheDocument()
  })

  it('displays all navigation tabs', () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    expect(screen.getByRole('button', { name: /impact calculator/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /what-if scenarios/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /template library/i })).toBeInTheDocument()
  })

  it('shows calculator tab content by default', () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    expect(screen.getByText('Cost Factors')).toBeInTheDocument()
    expect(screen.getByText('Schedule Factors')).toBeInTheDocument()
    expect(screen.getByText('Risk Factors')).toBeInTheDocument()
    expect(screen.getByText('Current Estimate')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /calculate impact/i })).toBeInTheDocument()
  })

  it('displays cost factor inputs', () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    expect(screen.getByLabelText(/material cost change/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/additional labor hours/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/labor rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/additional equipment days/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/overhead percentage/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contingency percentage/i)).toBeInTheDocument()
  })

  it('displays schedule factor inputs', () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    expect(screen.getByLabelText(/critical path impact/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/parallel work possible/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/weather dependent/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/resource availability/i)).toBeInTheDocument()
  })

  it('displays risk factor inputs', () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    expect(screen.getByLabelText(/technical complexity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/regulatory impact/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/stakeholder impact/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/external dependencies/i)).toBeInTheDocument()
  })

  it('updates input values when changed', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const materialCostInput = screen.getByLabelText(/material cost change/i)
    await user.clear(materialCostInput)
    await user.type(materialCostInput, '5000')
    
    expect(materialCostInput).toHaveValue(5000)
  })

  it('handles checkbox inputs correctly', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const criticalPathCheckbox = screen.getByLabelText(/critical path impact/i)
    expect(criticalPathCheckbox).not.toBeChecked()
    
    await user.click(criticalPathCheckbox)
    expect(criticalPathCheckbox).toBeChecked()
  })

  it('handles select inputs correctly', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const complexitySelect = screen.getByLabelText(/technical complexity/i)
    expect(complexitySelect).toHaveValue('medium')
    
    await user.selectOptions(complexitySelect, 'high')
    expect(complexitySelect).toHaveValue('high')
  })

  it('displays current estimate with default values', () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.getByText('0 days')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument() // Default confidence level
  })

  it('displays current estimate with provided values', () => {
    render(
      <ImpactEstimationTools 
        {...defaultProps} 
        currentEstimate={mockCurrentEstimate}
      />
    )
    
    expect(screen.getByText('$25,000')).toBeInTheDocument()
    expect(screen.getByText('14 days')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('performs calculation when calculate button is clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    // Set some input values
    const materialCostInput = screen.getByLabelText(/material cost change/i)
    await user.clear(materialCostInput)
    await user.type(materialCostInput, '10000')
    
    const laborHoursInput = screen.getByLabelText(/additional labor hours/i)
    await user.clear(laborHoursInput)
    await user.type(laborHoursInput, '100')
    
    const calculateButton = screen.getByRole('button', { name: /calculate impact/i })
    await user.click(calculateButton)
    
    // Should show calculating state
    expect(screen.getByText('Calculating...')).toBeInTheDocument()
    expect(calculateButton).toBeDisabled()
    
    // Wait for calculation to complete
    await waitFor(() => {
      expect(screen.queryByText('Calculating...')).not.toBeInTheDocument()
    }, { timeout: 2000 })
    
    expect(mockOnEstimateUpdate).toHaveBeenCalled()
  })

  it('resets calculator when reset button is clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    // Set some input values
    const materialCostInput = screen.getByLabelText(/material cost change/i)
    await user.clear(materialCostInput)
    await user.type(materialCostInput, '5000')
    
    const resetButton = screen.getByRole('button', { name: /reset/i })
    await user.click(resetButton)
    
    expect(materialCostInput).toHaveValue(0)
  })

  it('saves estimate when save button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ImpactEstimationTools 
        {...defaultProps} 
        currentEstimate={mockCurrentEstimate}
      />
    )
    
    const saveButton = screen.getByRole('button', { name: /save estimate/i })
    await user.click(saveButton)
    
    expect(mockOnEstimateUpdate).toHaveBeenCalledWith(mockCurrentEstimate)
  })

  it('switches to scenarios tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const scenariosTab = screen.getByRole('button', { name: /what-if scenarios/i })
    await user.click(scenariosTab)
    
    expect(screen.getByText('Scenario Analysis')).toBeInTheDocument()
    expect(screen.getByText('Optimistic Scenario')).toBeInTheDocument()
    expect(screen.getByText('Realistic Scenario')).toBeInTheDocument()
    expect(screen.getByText('Pessimistic Scenario')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create custom scenario/i })).toBeInTheDocument()
  })

  it('displays scenario cards with correct information', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const scenariosTab = screen.getByRole('button', { name: /what-if scenarios/i })
    await user.click(scenariosTab)
    
    expect(screen.getByText('Best case with minimal delays and cost overruns')).toBeInTheDocument()
    expect(screen.getByText('Most likely outcome based on historical data')).toBeInTheDocument()
    expect(screen.getByText('Worst case with significant delays and cost overruns')).toBeInTheDocument()
    
    // Check confidence levels
    expect(screen.getByText('20% confidence')).toBeInTheDocument()
    expect(screen.getByText('70% confidence')).toBeInTheDocument()
    expect(screen.getByText('10% confidence')).toBeInTheDocument()
  })

  it('applies scenario when apply button is clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const scenariosTab = screen.getByRole('button', { name: /what-if scenarios/i })
    await user.click(scenariosTab)
    
    const applyButtons = screen.getAllByText('Apply This Scenario')
    await user.click(applyButtons[0]) // Click first apply button
    
    expect(mockOnEstimateUpdate).toHaveBeenCalled()
  })

  it('switches to templates tab when clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const templatesTab = screen.getByRole('button', { name: /template library/i })
    await user.click(templatesTab)
    
    expect(screen.getByText('Template Library')).toBeInTheDocument()
    expect(screen.getByText('Pre-configured estimation templates for common change types')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create template/i })).toBeInTheDocument()
  })

  it('displays template cards with correct information', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const templatesTab = screen.getByRole('button', { name: /template library/i })
    await user.click(templatesTab)
    
    expect(screen.getByText('Design Change Template')).toBeInTheDocument()
    expect(screen.getByText('Scope Change Template')).toBeInTheDocument()
    expect(screen.getByText('Schedule Change Template')).toBeInTheDocument()
    
    expect(screen.getByText('Standard template for design modifications')).toBeInTheDocument()
    expect(screen.getByText('Template for scope additions or reductions')).toBeInTheDocument()
    expect(screen.getByText('Template for schedule acceleration or delays')).toBeInTheDocument()
  })

  it('displays template multipliers correctly', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const templatesTab = screen.getByRole('button', { name: /template library/i })
    await user.click(templatesTab)
    
    expect(screen.getByText('1.2x')).toBeInTheDocument() // Design change cost multiplier
    expect(screen.getByText('1.15x')).toBeInTheDocument() // Design change schedule multiplier
    expect(screen.getByText('1.1x')).toBeInTheDocument() // Design change risk factor
  })

  it('applies template when apply button is clicked', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const templatesTab = screen.getByRole('button', { name: /template library/i })
    await user.click(templatesTab)
    
    const applyButtons = screen.getAllByText('Apply Template')
    await user.click(applyButtons[0]) // Click first apply button
    
    // Switch back to calculator to see if template was applied
    const calculatorTab = screen.getByRole('button', { name: /impact calculator/i })
    await user.click(calculatorTab)
    
    // Should show template applied indicator
    expect(screen.getByText('Template Applied')).toBeInTheDocument()
    expect(screen.getByText('Design Change Template')).toBeInTheDocument()
  })

  it('displays estimation rules for templates', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const templatesTab = screen.getByRole('button', { name: /template library/i })
    await user.click(templatesTab)
    
    expect(screen.getAllByText('Estimation Rules:')).toHaveLength(3) // One for each template
    expect(screen.getByText('• Structural changes: +30%')).toBeInTheDocument()
    expect(screen.getByText('• MEP system impact: +20%')).toBeInTheDocument()
  })

  it('handles resource availability input validation', async () => {
    render(<ImpactEstimationTools {...defaultProps} />)
    
    // Find the resource availability input by its attributes
    const resourceAvailabilityInput = screen.getByDisplayValue('1')
    expect(resourceAvailabilityInput).toHaveAttribute('min', '0.1')
    expect(resourceAvailabilityInput).toHaveAttribute('max', '1.0')
    expect(resourceAvailabilityInput).toHaveAttribute('step', '0.1')
  })

  it('calculates confidence level based on risk factors', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    // Find select elements by their values
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThan(0)
    
    const calculateButton = screen.getByRole('button', { name: /calculate impact/i })
    await user.click(calculateButton)
    
    // Wait for calculation to complete
    await waitFor(() => {
      expect(screen.queryByText('Calculating...')).not.toBeInTheDocument()
    }, { timeout: 2000 })
    
    // Confidence level should be displayed as percentage
    const confidenceText = screen.getByText(/\d+%/)
    expect(confidenceText).toBeInTheDocument()
  })

  it('handles keyboard navigation between tabs', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    const calculatorTab = screen.getByRole('button', { name: /impact calculator/i })
    const scenariosTab = screen.getByRole('button', { name: /what-if scenarios/i })
    
    calculatorTab.focus()
    await user.keyboard('{Tab}')
    expect(scenariosTab).toHaveFocus()
  })

  it('maintains form state when switching tabs', async () => {
    const user = userEvent.setup()
    render(<ImpactEstimationTools {...defaultProps} />)
    
    // Find the first number input (material cost)
    const numberInputs = screen.getAllByRole('spinbutton')
    const materialCostInput = numberInputs[0]
    await user.clear(materialCostInput)
    await user.type(materialCostInput, '5000')
    
    // Switch to scenarios tab
    const scenariosTab = screen.getByRole('button', { name: /what-if scenarios/i })
    await user.click(scenariosTab)
    
    // Switch back to calculator
    const calculatorTab = screen.getByRole('button', { name: /impact calculator/i })
    await user.click(calculatorTab)
    
    // Value should be preserved
    expect(materialCostInput).toHaveValue(5000)
  })

  it('formats currency values correctly in estimate display', () => {
    render(
      <ImpactEstimationTools 
        {...defaultProps} 
        currentEstimate={mockCurrentEstimate}
      />
    )
    
    expect(screen.getByText('$25,000')).toBeInTheDocument()
    expect(screen.getByText('$5,000')).toBeInTheDocument()
  })

  it('displays progress bar for confidence level', () => {
    render(
      <ImpactEstimationTools 
        {...defaultProps} 
        currentEstimate={mockCurrentEstimate}
      />
    )
    
    // Check that confidence level is displayed
    expect(screen.getByText('75%')).toBeInTheDocument()
    // Check for the progress bar div
    const progressBarContainer = screen.getByText('75%').closest('div')
    expect(progressBarContainer).toBeInTheDocument()
  })
})