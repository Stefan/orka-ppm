/**
 * Navigation portfolio RBAC: Portfolios link/selector only visible with portfolio_read.
 * Checklist: Nav RBAC for Portfolios (TopBar, MobileNav).
 */

import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import TopBar from '@/components/navigation/TopBar'
import MobileNav from '@/components/navigation/MobileNav'
import { usePermissions } from '@/hooks/usePermissions'

jest.mock('@/hooks/usePermissions', () => ({
  usePermissions: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/dashboards',
}))

jest.mock('@/app/providers/SupabaseAuthProvider', () => ({
  useAuth: () => ({
    session: {
      user: { id: 'user-1', email: 'u@t.com', user_metadata: { full_name: 'User' } },
      access_token: 'token',
    },
    clearSession: jest.fn(),
  }),
}))

jest.mock('@/contexts/PortfolioContext', () => ({
  usePortfolio: () => ({
    currentPortfolioId: null,
    currentPortfolio: null,
    setCurrentPortfolioId: jest.fn(),
    portfolios: [],
    setPortfolios: jest.fn(),
  }),
}))

jest.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ currentLanguage: 'en', setLanguage: jest.fn() }),
}))

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
}))

jest.mock('@/lib/i18n/context', () => ({
  useTranslations: () => ({ t: (key: string) => key }),
}))

jest.mock('@/components/navigation/GlobalLanguageSelector', () => ({
  GlobalLanguageSelector: () => <div data-testid="language-selector">Lang</div>,
}))

jest.mock('@/hooks/useHelpChat', () => ({
  useHelpChat: () => ({
    state: { isOpen: false },
    toggleChat: jest.fn(),
    hasUnreadTips: false,
    getToggleButtonText: () => 'Help',
  }),
}))

jest.mock('@/hooks/useWorkflowRealtime', () => ({
  useWorkflowNotifications: () => ({ subscribe: jest.fn(), cleanup: jest.fn() }),
}))

jest.mock('@/app/providers/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}))

jest.mock('@/lib/api/dashboard-loader', () => ({ prefetchDashboardData: jest.fn() }))
jest.mock('@/lib/api/prefetch', () => ({ prefetchFinancials: jest.fn() }))
jest.mock('@/components/navigation/TopbarSearch', () => () => <div data-testid="topbar-search">Search</div>)

describe('Navigation portfolio RBAC', () => {
  beforeEach(() => {
    ;(usePermissions as jest.Mock).mockReturnValue({
      hasPermission: () => true,
      permissions: ['portfolio_read'],
      loading: false,
    })
  })

  describe('TopBar', () => {
    it('hides portfolio selector and Portfolios when user lacks portfolio_read', () => {
      ;(usePermissions as jest.Mock).mockReturnValue({
        hasPermission: (p: string) => p !== 'portfolio_read',
        permissions: [],
        loading: false,
      })

      render(<TopBar onMenuToggle={jest.fn()} />)

      expect(screen.queryByText('nav.portfolios')).not.toBeInTheDocument()
    })

    it('shows Portfolios in nav when user has portfolio_read', () => {
      render(<TopBar onMenuToggle={jest.fn()} />)

      expect(screen.getByText('nav.portfolios')).toBeInTheDocument()
    })
  })

  describe('MobileNav', () => {
    it('hides Portfolios link when user lacks portfolio_read', () => {
      ;(usePermissions as jest.Mock).mockReturnValue({
        hasPermission: (p: string) => p !== 'portfolio_read',
        permissions: [],
        loading: false,
      })

      render(<MobileNav isOpen={true} onClose={jest.fn()} />)

      expect(screen.queryByText('Portfolios')).not.toBeInTheDocument()
    })

    it('shows Portfolios link when user has portfolio_read', () => {
      render(<MobileNav isOpen={true} onClose={jest.fn()} />)

      expect(screen.getByText('Portfolios')).toBeInTheDocument()
    })
  })
})
