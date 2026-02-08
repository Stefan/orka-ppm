/**
 * Navigation Components Structure Tests
 * 
 * Tests that TopBar, MobileNav, and Sidebar navigation components
 * render all required elements and handle responsive behavior.
 * 
 * Requirements: 3.1, 3.2
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopBar from '@/components/navigation/TopBar';
import MobileNav from '@/components/navigation/MobileNav';
import { COMPONENT_STRUCTURES } from '@/lib/testing/structure-manifest';
import { verifyComponentStructure } from '@/lib/testing/structure-test-utils';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/dashboards',
  }),
  usePathname: () => '/dashboards',
}));

jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: {
      user: {
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: {
          full_name: 'Test User',
        },
      },
      access_token: 'mock-token',
    },
    clearSession: jest.fn(),
  }),
}));

jest.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    currentLanguage: 'en',
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  }),
}));

jest.mock('@/lib/i18n/context', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/navigation/GlobalLanguageSelector', () => ({
  GlobalLanguageSelector: ({ variant }: { variant: string }) => (
    <div data-testid={`language-selector-${variant}`}>Language Selector</div>
  ),
}));

describe('TopBar Component Structure', () => {
  const structure = COMPONENT_STRUCTURES['top-bar'];

  beforeEach(() => {
    // Mock window.innerWidth for responsive behavior
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  describe('Basic Structure', () => {
    it('renders all required elements', () => {
      const result = render(<TopBar onMenuToggle={jest.fn()} />);

      // Verify component structure
      const verification = verifyComponentStructure(result, structure);

      expect(verification.passed).toBe(true);
      expect(verification.missingElements).toEqual([]);

      // Verify all required elements are present
      expect(screen.getByTestId('top-bar')).toBeInTheDocument();
      expect(screen.getByTestId('top-bar-logo')).toBeInTheDocument();
      expect(screen.getByTestId('top-bar-menu-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('top-bar-nav')).toBeInTheDocument();
      expect(screen.getByTestId('top-bar-actions')).toBeInTheDocument();
      expect(screen.getByTestId('top-bar-notifications')).toBeInTheDocument();
      expect(screen.getByTestId('top-bar-user-menu')).toBeInTheDocument();
    });

    it('displays logo and brand name', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const logo = screen.getByTestId('top-bar-logo');
      expect(logo).toBeInTheDocument();
      expect(screen.getByText('ORKA PPM')).toBeInTheDocument();
    });

    it('displays navigation links', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const nav = screen.getByTestId('top-bar-nav');
      expect(nav).toBeInTheDocument();
      expect(screen.getByText('nav.dashboards')).toBeInTheDocument();
      expect(screen.getByText('nav.scenarios')).toBeInTheDocument();
      expect(screen.getByText('nav.resources')).toBeInTheDocument();
      expect(screen.getByText('nav.reports')).toBeInTheDocument();
      expect(screen.getByText('nav.financials')).toBeInTheDocument();
    });
  });

  describe('User Menu', () => {
    it('displays user menu button', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const userMenu = screen.getByTestId('top-bar-user-menu');
      expect(userMenu).toBeInTheDocument();
    });

    it('opens user menu on click', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const userMenu = screen.getByTestId('top-bar-user-menu');
      fireEvent.click(userMenu);

      // User dropdown should appear
      expect(screen.getByText('Profile Settings')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('displays user information in dropdown', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const userMenu = screen.getByTestId('top-bar-user-menu');
      fireEvent.click(userMenu);

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Notifications', () => {
    it('displays notifications button', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const notifications = screen.getByTestId('top-bar-notifications');
      expect(notifications).toBeInTheDocument();
    });

    it('opens notifications panel on click', async () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const notifications = screen.getByTestId('top-bar-notifications');
      fireEvent.click(notifications);
      // Panel shows title or empty state (badge only appears when unread count > 0)
      await screen.findByRole('dialog', { name: /notifications/i });
    });
  });

  describe('Mobile Menu Toggle', () => {
    it('displays menu toggle button', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const menuToggle = screen.getByTestId('top-bar-menu-toggle');
      expect(menuToggle).toBeInTheDocument();
    });

    it('calls onMenuToggle when clicked', () => {
      const onMenuToggle = jest.fn();
      render(<TopBar onMenuToggle={onMenuToggle} />);

      const menuToggle = screen.getByTestId('top-bar-menu-toggle');
      fireEvent.click(menuToggle);

      expect(onMenuToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('Language Selector', () => {
    it('displays language selector', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      expect(screen.getByTestId('language-selector-topbar')).toBeInTheDocument();
    });
  });

  describe('More Menu', () => {
    it('displays more menu button', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      expect(screen.getByText('nav.more')).toBeInTheDocument();
    });

    it('opens more menu dropdown on click', () => {
      render(<TopBar onMenuToggle={jest.fn()} />);

      const moreButton = screen.getByText('nav.more');
      fireEvent.click(moreButton);

      // More menu items should appear
      expect(screen.getByText('nav.risks')).toBeInTheDocument();
      expect(screen.getByText('nav.monteCarlo')).toBeInTheDocument();
      expect(screen.getByText('Change Management')).toBeInTheDocument();
      expect(screen.getByText('Feedback & Ideas')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('hides navigation on small screens', () => {
      // Set small screen width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });

      render(<TopBar onMenuToggle={jest.fn()} />);

      const nav = screen.getByTestId('top-bar-nav');
      // Navigation should have display: none style on small screens
      expect(nav).toHaveStyle({ display: 'none' });
    });

    it('shows navigation on large screens', () => {
      // Set large screen width
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<TopBar onMenuToggle={jest.fn()} />);

      const nav = screen.getByTestId('top-bar-nav');
      // Navigation should be visible on large screens
      expect(nav).toBeInTheDocument();
    });
  });
});

describe('MobileNav Component Structure', () => {
  const structure = COMPONENT_STRUCTURES['mobile-nav'];

  describe('Basic Structure - Closed State', () => {
    it('does not render when closed', () => {
      render(<MobileNav isOpen={false} onClose={jest.fn()} />);

      // Mobile nav should not be in the document when closed
      expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
    });
  });

  describe('Basic Structure - Open State', () => {
    it('renders all required elements when open', () => {
      const result = render(<MobileNav isOpen={true} onClose={jest.fn()} />);

      // Verify component structure
      const verification = verifyComponentStructure(result, structure);

      expect(verification.passed).toBe(true);
      expect(verification.missingElements).toEqual([]);

      // Verify all required elements are present
      expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-header')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-close')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-nav-links')).toBeInTheDocument();
    });

    it('displays logo and brand name', () => {
      render(<MobileNav isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText('ORKA PPM')).toBeInTheDocument();
      expect(screen.getByText('Portfolio Management')).toBeInTheDocument();
    });

    it('displays all navigation links', () => {
      render(<MobileNav isOpen={true} onClose={jest.fn()} />);

      expect(screen.getByText('Portfolio Dashboards')).toBeInTheDocument();
      expect(screen.getByText('What-If Scenarios')).toBeInTheDocument();
      expect(screen.getByText('Resource Management')).toBeInTheDocument();
      expect(screen.getByText('AI Reports & Analytics')).toBeInTheDocument();
      expect(screen.getByText('Financial Tracking')).toBeInTheDocument();
      expect(screen.getByText('Risk/Issue Registers')).toBeInTheDocument();
      expect(screen.getByText('Monte Carlo Analysis')).toBeInTheDocument();
      expect(screen.getByText('Change Management')).toBeInTheDocument();
      expect(screen.getByText('Feedback & Ideas')).toBeInTheDocument();
      expect(screen.getByText('Performance Monitor')).toBeInTheDocument();
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });
  });

  describe('Close Button', () => {
    it('displays close button', () => {
      render(<MobileNav isOpen={true} onClose={jest.fn()} />);

      const closeButton = screen.getByTestId('mobile-nav-close');
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      render(<MobileNav isOpen={true} onClose={onClose} />);

      const closeButton = screen.getByTestId('mobile-nav-close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is clicked', () => {
      const onClose = jest.fn();
      const { container } = render(<MobileNav isOpen={true} onClose={onClose} />);

      // Find the overlay (first div with bg-black class)
      const overlay = container.querySelector('.bg-black');
      expect(overlay).toBeInTheDocument();

      if (overlay) {
        fireEvent.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('Navigation Links', () => {
    it('calls onClose when a navigation link is clicked', () => {
      const onClose = jest.fn();
      render(<MobileNav isOpen={true} onClose={onClose} />);

      const dashboardLink = screen.getByText('Portfolio Dashboards');
      fireEvent.click(dashboardLink);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('highlights active link based on current pathname', () => {
      render(<MobileNav isOpen={true} onClose={jest.fn()} />);

      const dashboardLink = screen.getByText('Portfolio Dashboards');
      // Active link should have bg-blue-50 and text-blue-700 classes
      const linkElement = dashboardLink.closest('a');
      expect(linkElement).toHaveClass('bg-blue-50');
      expect(linkElement).toHaveClass('text-blue-700');
    });
  });

  describe('Keyboard Interaction', () => {
    it('closes on Escape key press', () => {
      const onClose = jest.fn();
      render(<MobileNav isOpen={true} onClose={onClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has proper aria-label on close button', () => {
      render(<MobileNav isOpen={true} onClose={jest.fn()} />);

      const closeButton = screen.getByTestId('mobile-nav-close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close menu');
    });
  });
});
