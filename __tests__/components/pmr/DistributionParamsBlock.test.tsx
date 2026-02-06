/**
 * Unit tests for DistributionParamsBlock
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { DistributionParamsBlock } from '@/components/pmr/DistributionParamsBlock'
import type { DistributionSettings } from '@/types/costbook'

const defaultValue: DistributionSettings = {
  profile: 'linear',
  duration_start: '2024-01-01',
  duration_end: '2024-12-31',
  granularity: 'month',
}

describe('DistributionParamsBlock', () => {
  it('renders profile and granularity selects', () => {
    const onChange = jest.fn()
    render(<DistributionParamsBlock value={defaultValue} onChange={onChange} />)
    expect(screen.getByText(/Forecast-Profil|Spend-Verlauf/)).toBeInTheDocument()
    const profileSelect = screen.getByRole('combobox', { name: /Profil/i })
    const granularitySelect = screen.getByRole('combobox', { name: /Granularität/i })
    expect(profileSelect).toHaveValue('linear')
    expect(granularitySelect).toHaveValue('month')
  })

  it('calls onChange when profile changes', () => {
    const onChange = jest.fn()
    render(<DistributionParamsBlock value={defaultValue} onChange={onChange} />)
    const profileSelect = screen.getByRole('combobox', { name: /Profil/i })
    fireEvent.change(profileSelect, { target: { value: 'custom' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ profile: 'custom' }))
  })

  it('shows custom distribution input when profile is custom', () => {
    const onChange = jest.fn()
    render(
      <DistributionParamsBlock
        value={{ ...defaultValue, profile: 'custom' }}
        onChange={onChange}
      />
    )
    expect(screen.getByPlaceholderText(/10, 20, 30/)).toBeInTheDocument()
  })
})
