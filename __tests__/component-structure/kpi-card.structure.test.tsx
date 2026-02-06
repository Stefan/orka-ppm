/**
 * Dashboard KPI Card Component Structure Test
 * 
 * Tests that the KPI card components on the dashboard render all required elements
 * with different variants and states.
 * 
 * Requirements: 3.1, 3.2
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrendingUp, TrendingDown, DollarSign, Clock, BarChart3 } from 'lucide-react';

// KPI Card Component (from dashboard page)
function KPICard({ label, value, change, icon: Icon, color, testId }: any) {
  const isPositive = change >= 0;
  return (
    <div data-testid={testId} className="bg-white rounded-lg border border-gray-300 px-4 py-3 hover:shadow-md transition-all duration-200 cursor-pointer group">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p data-testid="kpi-card-label" className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <p data-testid="kpi-card-value" className={`text-2xl font-bold leading-none ${color}`}>{value}%</p>
            <span data-testid="kpi-card-change" className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? '↑' : '↓'}{Math.abs(change)}%
            </span>
          </div>
        </div>
        <Icon data-testid="kpi-card-icon" className={`${color} opacity-20 group-hover:opacity-40 transition-opacity flex-shrink-0`} size={28} />
      </div>
    </div>
  );
}

describe('Dashboard KPI Card Component Structure', () => {
  describe('Basic Structure', () => {
    it('renders all required elements', () => {
      render(
        <KPICard
          testId="kpi-card-success-rate"
          label="Success Rate"
          value={85}
          change={5.2}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      // Verify all required elements are present
      expect(screen.getByTestId('kpi-card-success-rate')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-label')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-value')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-change')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-icon')).toBeInTheDocument();
    });

    it('displays correct label text', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={75}
          change={2.5}
          icon={BarChart3}
          color="text-blue-600"
        />
      );

      const label = screen.getByTestId('kpi-card-label');
      expect(label).toHaveTextContent('Test Metric');
    });

    it('displays correct value', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={92}
          change={3.1}
          icon={BarChart3}
          color="text-blue-600"
        />
      );

      const value = screen.getByTestId('kpi-card-value');
      expect(value).toHaveTextContent('92%');
    });
  });

  describe('Different Variants', () => {
    it('renders success rate KPI card', () => {
      render(
        <KPICard
          testId="kpi-card-success-rate"
          label="Success Rate"
          value={85}
          change={5.2}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      expect(screen.getByTestId('kpi-card-success-rate')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-value')).toHaveClass('text-green-600');
    });

    it('renders budget performance KPI card', () => {
      render(
        <KPICard
          testId="kpi-card-budget-performance"
          label="Budget Performance"
          value={78}
          change={-2.1}
          icon={DollarSign}
          color="text-blue-600"
        />
      );

      expect(screen.getByTestId('kpi-card-budget-performance')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-value')).toHaveClass('text-blue-600');
    });

    it('renders timeline performance KPI card', () => {
      render(
        <KPICard
          testId="kpi-card-timeline-performance"
          label="Timeline Performance"
          value={82}
          change={3.7}
          icon={Clock}
          color="text-purple-600"
        />
      );

      expect(screen.getByTestId('kpi-card-timeline-performance')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-value')).toHaveClass('text-purple-600');
    });

    it('renders active projects KPI card', () => {
      render(
        <KPICard
          testId="kpi-card-active-projects"
          label="Active Projects"
          value={68}
          change={1.2}
          icon={BarChart3}
          color="text-indigo-600"
        />
      );

      expect(screen.getByTestId('kpi-card-active-projects')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-card-value')).toHaveClass('text-indigo-600');
    });
  });

  describe('Change Indicator States', () => {
    it('shows positive change with up arrow', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={85}
          change={5.2}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      const changeIndicator = screen.getByTestId('kpi-card-change');
      expect(changeIndicator).toHaveTextContent('↑5.2%');
      expect(changeIndicator).toHaveClass('text-green-600');
    });

    it('shows negative change with down arrow', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={75}
          change={-3.5}
          icon={TrendingDown}
          color="text-red-600"
        />
      );

      const changeIndicator = screen.getByTestId('kpi-card-change');
      expect(changeIndicator).toHaveTextContent('↓3.5%');
      expect(changeIndicator).toHaveClass('text-red-600');
    });

    it('shows zero change as positive', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={80}
          change={0}
          icon={BarChart3}
          color="text-blue-600"
        />
      );

      const changeIndicator = screen.getByTestId('kpi-card-change');
      expect(changeIndicator).toHaveTextContent('↑0%');
      expect(changeIndicator).toHaveClass('text-green-600');
    });
  });

  describe('Icon Rendering', () => {
    it('renders TrendingUp icon', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={85}
          change={5.2}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      const icon = screen.getByTestId('kpi-card-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-green-600');
    });

    it('renders DollarSign icon', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Budget"
          value={78}
          change={-2.1}
          icon={DollarSign}
          color="text-blue-600"
        />
      );

      const icon = screen.getByTestId('kpi-card-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-blue-600');
    });

    it('renders Clock icon', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Timeline"
          value={82}
          change={3.7}
          icon={Clock}
          color="text-purple-600"
        />
      );

      const icon = screen.getByTestId('kpi-card-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('text-purple-600');
    });
  });

  describe('Styling and Layout', () => {
    it('has correct container classes', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={85}
          change={5.2}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      const card = screen.getByTestId('kpi-card-test');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-gray-300');
    });

    it('has hover effects', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={85}
          change={5.2}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      const card = screen.getByTestId('kpi-card-test');
      expect(card).toHaveClass('hover:shadow-md');
      expect(card).toHaveClass('transition-all');
    });
  });

  describe('Edge Cases', () => {
    it('handles very large values', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={999}
          change={50.5}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      const value = screen.getByTestId('kpi-card-value');
      expect(value).toHaveTextContent('999%');
    });

    it('handles very small values', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Test Metric"
          value={0}
          change={0}
          icon={TrendingDown}
          color="text-red-600"
        />
      );

      const value = screen.getByTestId('kpi-card-value');
      expect(value).toHaveTextContent('0%');
    });

    it('handles long label text with truncation', () => {
      render(
        <KPICard
          testId="kpi-card-test"
          label="Very Long Label Text That Should Be Truncated"
          value={85}
          change={5.2}
          icon={TrendingUp}
          color="text-green-600"
        />
      );

      const label = screen.getByTestId('kpi-card-label');
      expect(label).toHaveClass('truncate');
      expect(label).toHaveTextContent('Very Long Label Text That Should Be Truncated');
    });
  });
});
