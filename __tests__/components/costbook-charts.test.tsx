/**
 * Unit tests for Costbook chart rendering (Task 55.3)
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { VarianceWaterfall } from '@/components/costbook/VarianceWaterfall'
import { EVMTrendChart } from '@/components/costbook/EVMTrendChart'
import { Currency } from '@/types/costbook'
import { EVMHistoryPoint } from '@/types/evm'

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
  Cell: () => null,
  Area: () => null,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>
}))

describe('Costbook Charts (Task 55.3)', () => {
  it('VarianceWaterfall renders with container', () => {
    render(
      <VarianceWaterfall
        totalBudget={100000}
        totalCommitments={60000}
        totalActuals={40000}
        variance={0}
        currency={Currency.USD}
      />
    )
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('EVMTrendChart renders with mock history', () => {
    const history: EVMHistoryPoint[] = [
      { date: '2024-01-01', cpi: 1.0, spi: 1.0, eac: 100 },
      { date: '2024-02-01', cpi: 1.1, spi: 0.95, eac: 105 }
    ]
    render(<EVMTrendChart history={history} />)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })
})
