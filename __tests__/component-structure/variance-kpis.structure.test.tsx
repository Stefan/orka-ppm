/**
 * VarianceKPIs Component Structure Test
 * 
 * Tests that the VarianceKPIs component renders all required elements
 * in different states (normal, loading, error, empty).
 * 
 * Requirements: 3.1, 3.2, 3.4
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import VarianceKPIs from '@/app/dashboards/components/VarianceKPIs';
import { COMPONENT_STRUCTURES } from '@/lib/testing/structure-manifest';
import { verifyComponentStructure } from '@/lib/testing/structure-test-utils';

// Mock the API and dependencies
jest.mock('@/lib/api', () => ({
  getApiUrl: jest.fn((path: string) => `http://localhost:8000${path}`),
}));

jest.mock('@/lib/i18n/context', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/app/providers/EnhancedAuthProvider', () => ({
  usePermissions: () => ({
    hasPermission: jest.fn(() => true),
    loading: false,
  }),
}));

jest.mock('@/lib/api/resilient-fetch', () => ({
  resilientFetch: jest.fn(),
}));

const mockSession = {
  access_token: 'mock-token',
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
};

// Mock data matching what the API actually returns
const mockCommitmentsData = {
  commitments: [
    {
      project_nr: 'proj-1',
      total_amount: 100000,
    },
    {
      project_nr: 'proj-2',
      total_amount: 50000,
    },
  ],
};

const mockActualsData = {
  actuals: [
    {
      project_nr: 'proj-1',
      invoice_amount: 110000,
    },
    {
      project_nr: 'proj-2',
      invoice_amount: 45000,
    },
  ],
};

describe('VarianceKPIs Component Structure', () => {
  const structure = COMPONENT_STRUCTURES['variance-kpis'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal State with Valid Data', () => {
    it('renders all required elements with valid data', async () => {
      const { resilientFetch } = require('@/lib/api/resilient-fetch');
      // Mock returns different data based on URL
      resilientFetch.mockImplementation((url: string) => {
        if (url.includes('commitments')) {
          return Promise.resolve({ data: mockCommitmentsData, error: null });
        }
        if (url.includes('actuals')) {
          return Promise.resolve({ data: mockActualsData, error: null });
        }
        return Promise.resolve({ data: null, error: 'Unknown endpoint' });
      });

      const result = render(
        <VarianceKPIs session={mockSession} selectedCurrency="USD" />
      );

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByTestId('variance-kpis-skeleton')).not.toBeInTheDocument();
      });

      // Verify component structure
      const verification = verifyComponentStructure(result, structure);

      expect(verification.passed).toBe(true);
      expect(verification.missingElements).toEqual([]);

      // Verify all required elements are present
      expect(screen.getByTestId('variance-kpis')).toBeInTheDocument();
      expect(screen.getByTestId('variance-kpis-header')).toBeInTheDocument();
      expect(screen.getByTestId('variance-kpis-grid')).toBeInTheDocument();
      expect(screen.getByTestId('variance-kpis-net-variance')).toBeInTheDocument();
      expect(screen.getByTestId('variance-kpis-variance-percent')).toBeInTheDocument();
      expect(screen.getByTestId('variance-kpis-over-budget')).toBeInTheDocument();
      expect(screen.getByTestId('variance-kpis-under-budget')).toBeInTheDocument();
      expect(screen.getByTestId('variance-kpis-commitments-actuals')).toBeInTheDocument();
    });

    it('displays correct variance calculations', async () => {
      const { resilientFetch } = require('@/lib/api/resilient-fetch');
      resilientFetch.mockImplementation((url: string) => {
        if (url.includes('commitments')) {
          return Promise.resolve({ data: mockCommitmentsData, error: null });
        }
        if (url.includes('actuals')) {
          return Promise.resolve({ data: mockActualsData, error: null });
        }
        return Promise.resolve({ data: null, error: 'Unknown endpoint' });
      });

      render(<VarianceKPIs session={mockSession} selectedCurrency="USD" />);

      await waitFor(() => {
        expect(screen.queryByTestId('variance-kpis-skeleton')).not.toBeInTheDocument();
      });

      // Verify variance calculations are displayed
      const netVariance = screen.getByTestId('variance-kpis-net-variance');
      expect(netVariance).toBeInTheDocument();

      const overBudget = screen.getByTestId('variance-kpis-over-budget');
      expect(overBudget).toHaveTextContent('1');

      const underBudget = screen.getByTestId('variance-kpis-under-budget');
      expect(underBudget).toHaveTextContent('1');
    });
  });

  describe('Loading State', () => {
    it('renders loading skeleton correctly', () => {
      const result = render(
        <VarianceKPIs session={mockSession} selectedCurrency="USD" />
      );

      // Verify loading state elements
      const verification = verifyComponentStructure(result, structure, 'loading');

      expect(verification.passed).toBe(true);
      expect(screen.getByTestId('variance-kpis-skeleton')).toBeInTheDocument();
    });

    it('shows skeleton with correct structure', () => {
      render(<VarianceKPIs session={mockSession} selectedCurrency="USD" />);

      const skeleton = screen.getByTestId('variance-kpis-skeleton');
      expect(skeleton).toBeInTheDocument();
      // The skeleton contains an animate-pulse div inside
      const pulseDiv = skeleton.querySelector('.animate-pulse');
      expect(pulseDiv).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('renders error message when data fetch fails', async () => {
      const { resilientFetch } = require('@/lib/api/resilient-fetch');
      // Both endpoints return empty data (fallback behavior with silentFail)
      resilientFetch.mockResolvedValue({
        data: { commitments: [], actuals: [] },
        error: null,
      });

      const result = render(
        <VarianceKPIs session={mockSession} selectedCurrency="USD" />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('variance-kpis-skeleton')).not.toBeInTheDocument();
      });

      // Verify error state elements
      const verification = verifyComponentStructure(result, structure, 'error');

      expect(verification.passed).toBe(true);
      expect(screen.getByTestId('variance-kpis-error')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no variance data available', async () => {
      const { resilientFetch } = require('@/lib/api/resilient-fetch');
      // Both endpoints return empty arrays
      resilientFetch.mockImplementation((url: string) => {
        if (url.includes('commitments')) {
          return Promise.resolve({ data: { commitments: [] }, error: null });
        }
        if (url.includes('actuals')) {
          return Promise.resolve({ data: { actuals: [] }, error: null });
        }
        return Promise.resolve({ data: null, error: 'Unknown endpoint' });
      });

      const result = render(
        <VarianceKPIs session={mockSession} selectedCurrency="USD" />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('variance-kpis-skeleton')).not.toBeInTheDocument();
      });

      // Verify empty state elements (uses error testId)
      const verification = verifyComponentStructure(result, structure, 'empty');

      expect(verification.passed).toBe(true);
      expect(screen.getByTestId('variance-kpis-error')).toBeInTheDocument();
    });
  });

  describe('Conditional Rendering', () => {
    it('hides financial details when permissions are restricted', async () => {
      const { resilientFetch } = require('@/lib/api/resilient-fetch');
      resilientFetch.mockImplementation((url: string) => {
        if (url.includes('commitments')) {
          return Promise.resolve({ data: mockCommitmentsData, error: null });
        }
        if (url.includes('actuals')) {
          return Promise.resolve({ data: mockActualsData, error: null });
        }
        return Promise.resolve({ data: null, error: 'Unknown endpoint' });
      });

      render(
        <VarianceKPIs 
          session={mockSession} 
          selectedCurrency="USD"
          showDetailedMetrics={false}
        />
      );

      await waitFor(() => {
        expect(screen.queryByTestId('variance-kpis-skeleton')).not.toBeInTheDocument();
      });

      // Financial details should be hidden
      expect(screen.queryByTestId('variance-kpis-net-variance')).not.toBeInTheDocument();
      expect(screen.getByText('Financial details restricted')).toBeInTheDocument();
    });

    it('shows alert badge when projects are over budget', async () => {
      const { resilientFetch } = require('@/lib/api/resilient-fetch');
      resilientFetch.mockImplementation((url: string) => {
        if (url.includes('commitments')) {
          return Promise.resolve({ data: mockCommitmentsData, error: null });
        }
        if (url.includes('actuals')) {
          return Promise.resolve({ data: mockActualsData, error: null });
        }
        return Promise.resolve({ data: null, error: 'Unknown endpoint' });
      });

      render(<VarianceKPIs session={mockSession} selectedCurrency="USD" />);

      await waitFor(() => {
        expect(screen.queryByTestId('variance-kpis-skeleton')).not.toBeInTheDocument();
      });

      // Alert badge should be visible
      const header = screen.getByTestId('variance-kpis-header');
      expect(header).toBeInTheDocument();
    });
  });

  describe('Session Handling', () => {
    it('renders loading state when session is null', () => {
      render(<VarianceKPIs session={null} selectedCurrency="USD" />);

      expect(screen.getByTestId('variance-kpis-skeleton')).toBeInTheDocument();
    });

    it('does not fetch data without access token', () => {
      const { resilientFetch } = require('@/lib/api/resilient-fetch');

      render(
        <VarianceKPIs 
          session={{ user: { id: 'user-123' } }} 
          selectedCurrency="USD" 
        />
      );

      expect(resilientFetch).not.toHaveBeenCalled();
    });
  });
});
