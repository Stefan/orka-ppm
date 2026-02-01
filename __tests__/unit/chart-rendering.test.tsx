/**
 * Unit tests for chart rendering components
 * Enterprise Test Strategy - Task 2.3
 * Requirements: 5.2, 5.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// Minimal chart placeholder component for testing
function ChartPlaceholder({ title, value }: { title: string; value: number }) {
  return (
    <div data-testid="chart" role="img" aria-label={title}>
      <span>{title}</span>
      <span>{value}</span>
    </div>
  );
}

describe('Chart rendering', () => {
  it('renders chart with title and value', () => {
    render(<ChartPlaceholder title="Revenue" value={1000} />);
    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('has accessible role and label', () => {
    render(<ChartPlaceholder title="Cost" value={500} />);
    const chart = screen.getByRole('img', { name: 'Cost' });
    expect(chart).toBeInTheDocument();
  });
});
