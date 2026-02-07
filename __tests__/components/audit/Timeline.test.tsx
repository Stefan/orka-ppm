/**
 * Unit tests for audit Timeline component.
 * Regression: ensures hooks are called in consistent order (no "Rendered more hooks
 * than during the previous render" when toggling loading / empty / with data).
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import Timeline from '@/components/audit/Timeline'
import type { AuditEvent } from '@/components/audit/Timeline'

jest.mock('@/lib/i18n/context', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}))

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ScatterChart: ({ children }: { children: React.ReactNode }) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Cell: () => null,
  ZAxis: () => null,
}))

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'ev-1',
    event_type: 'project_updated',
    user_id: 'u1',
    user_name: 'Test User',
    entity_type: 'project',
    entity_id: 'proj-1',
    timestamp: new Date().toISOString(),
    severity: 'info',
    description: 'Project updated',
    is_anomaly: false,
    tenant_id: 't1',
    ...overrides,
  }
}

describe('Timeline', () => {
  it('renders loading state without error', () => {
    render(<Timeline events={[]} loading={true} />)
    expect(screen.getByText(/audit\.loadingTimeline/)).toBeInTheDocument()
  })

  it('renders empty state without error', () => {
    render(<Timeline events={[]} loading={false} />)
    expect(screen.getByText(/audit\.noEventsToDisplay/)).toBeInTheDocument()
  })

  it('renders with events without error', () => {
    render(<Timeline events={[makeEvent()]} loading={false} />)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })

  it('does not change hook count when switching loading -> empty -> with data (regression)', () => {
    const { rerender } = render(<Timeline events={[]} loading={true} />)
    expect(screen.getByText(/audit\.loadingTimeline/)).toBeInTheDocument()

    rerender(<Timeline events={[]} loading={false} />)
    expect(screen.getByText(/audit\.noEventsToDisplay/)).toBeInTheDocument()

    rerender(<Timeline events={[makeEvent()]} loading={false} />)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument()
  })
})
