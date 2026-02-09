'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  LogOut,
  Menu,
  X,
  User,
  Bell,
  ChevronDown,
  MoreHorizontal,
  BarChart3,
  GitPullRequest,
  MessageSquare,
  Activity,
  Users,
  FileText,
  Layers,
  Shield,
  GitBranch,
  DollarSign,
  AlertTriangle,
  Settings,
  Sun,
  Moon,
  Monitor,
  Target,
  Calendar,
  BookOpen,
  Upload,
  PanelRightOpen,
  PanelRightClose,
  Lightbulb,
  FolderOpen,
} from 'lucide-react'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { prefetchDashboardData } from '@/lib/api/dashboard-loader'
import { prefetchFinancials } from '@/lib/api/prefetch'
import { useHelpChat } from '@/hooks/useHelpChat'
import { useNotifications } from '@/hooks/useNotifications'
import { GlobalLanguageSelector } from './GlobalLanguageSelector'
import { useLanguage } from '@/hooks/useLanguage'
import { useTranslations } from '@/lib/i18n/context'
import TopbarSearch from './TopbarSearch'
import { cn } from '@/lib/utils/design-system'
import { useWorkflowNotifications } from '@/hooks/useWorkflowRealtime'

type TTopbar = (key: string, params?: Record<string, unknown>) => string

function formatNotificationTime(iso: string, t: TTopbar): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return t('topbar.justNow')
  if (diffM < 60) return t('topbar.minutesAgo', { count: diffM })
  if (diffH < 24) return t('topbar.hoursAgo', { count: diffH })
  if (diffD === 1) return t('topbar.yesterday')
  if (diffD < 7) return t('topbar.daysAgo', { count: diffD })
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export interface TopBarProps {
  onMenuToggle?: () => void
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, clearSession } = useAuth()
  const { currentLanguage } = useLanguage()
  const { t } = useTranslations()
  const { state: helpState, toggleChat, hasUnreadTips, getToggleButtonText } = useHelpChat()
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications(session?.access_token)
  const workflowNotifications = useWorkflowNotifications(session?.user?.id ?? null)

  // Realtime: when a new notification is inserted, refresh list and badge
  const refetchRef = useRef(refetchNotifications)
  refetchRef.current = refetchNotifications
  const userId = session?.user?.id ?? null
  useEffect(() => {
    if (!userId) return
    workflowNotifications.subscribe(() => {
      refetchRef.current()
    })
    return () => workflowNotifications.cleanup()
  }, [userId, workflowNotifications])

  const { currentPortfolioId, currentPortfolio, setCurrentPortfolioId, portfolios, setPortfolios } = usePortfolio()
  const { hasPermission } = usePermissions()
  const canReadPortfolios = hasPermission('portfolio_read')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [portfolioMenuOpen, setPortfolioMenuOpen] = useState(false)
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false)
  const [financialsMenuOpen, setFinancialsMenuOpen] = useState(false)
  const [analysisMenuOpen, setAnalysisMenuOpen] = useState(false)
  const [managementMenuOpen, setManagementMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const portfolioMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const projectsMenuRef = useRef<HTMLDivElement>(null)
  const financialsMenuRef = useRef<HTMLDivElement>(null)
  const analysisMenuRef = useRef<HTMLDivElement>(null)
  const managementMenuRef = useRef<HTMLDivElement>(null)
  const adminMenuRef = useRef<HTMLDivElement>(null)

  // Load portfolios for selector (and sync to context)
  useEffect(() => {
    if (!session?.access_token) return
    fetch('/api/portfolios', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to fetch portfolios'))))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items ?? data?.portfolios ?? []
        setPortfolios(list.map((p: { id: string; name: string; description?: string; owner_id: string }) => ({ id: p.id, name: p.name, description: p.description, owner_id: p.owner_id })))
      })
      .catch(() => {})
  }, [session?.access_token, setPortfolios])

  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out...')
      await clearSession()
      console.log('✅ Logout successful')
      router.push('/')
      window.location.href = '/'
    } catch (err) {
      console.error('🚨 Logout exception:', err)
      router.push('/')
    }
  }

  // Close menus when clicking outside (use 'click' so the same gesture that opened the menu doesn't close it)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (portfolioMenuRef.current && !portfolioMenuRef.current.contains(event.target as Node)) {
        setPortfolioMenuOpen(false)
      }
      if (projectsMenuRef.current && !projectsMenuRef.current.contains(event.target as Node)) {
        setProjectsMenuOpen(false)
      }
      if (financialsMenuRef.current && !financialsMenuRef.current.contains(event.target as Node)) {
        setFinancialsMenuOpen(false)
      }
      if (analysisMenuRef.current && !analysisMenuRef.current.contains(event.target as Node)) {
        setAnalysisMenuOpen(false)
      }
      if (managementMenuRef.current && !managementMenuRef.current.contains(event.target as Node)) {
        setManagementMenuOpen(false)
      }
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        setAdminMenuOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }

    if (portfolioMenuOpen || projectsMenuOpen || financialsMenuOpen || analysisMenuOpen || managementMenuOpen || adminMenuOpen || userMenuOpen || notificationsOpen || moreMenuOpen) {
      document.addEventListener('click', handleClickOutside)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [portfolioMenuOpen, projectsMenuOpen, financialsMenuOpen, analysisMenuOpen, managementMenuOpen, adminMenuOpen, userMenuOpen, notificationsOpen, moreMenuOpen])

  const userEmail = session?.user?.email || 'User'
  const userName = session?.user?.user_metadata?.full_name || userEmail.split('@')[0]
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
  }

  const themeIcon = theme === 'dark' ? Moon : theme === 'system' ? Monitor : Sun
  const ThemeIcon = themeIcon

  // Close all dropdown menus
  const closeAllDropdowns = () => {
    setPortfolioMenuOpen(false)
    setProjectsMenuOpen(false)
    setFinancialsMenuOpen(false)
    setAnalysisMenuOpen(false)
    setManagementMenuOpen(false)
    setAdminMenuOpen(false)
    setUserMenuOpen(false)
    setNotificationsOpen(false)
    setMoreMenuOpen(false)
  }

  // Toggle a specific dropdown, closing all others first
  const toggleDropdown = (setter: React.Dispatch<React.SetStateAction<boolean>>, current: boolean) => {
    closeAllDropdowns()
    if (!current) {
      setter(true)
    }
  }

  const openMoreMenu = () => {
    closeAllDropdowns()
    setMoreMenuOpen(true)
  }

  // Navigation link styles (first-level menu items)
  const navLinkBase = 'px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200'
  const navLinkActive = 'bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/50'
  const navLinkInactive = 'text-gray-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-100/80 dark:hover:bg-slate-700/80'
  // Style for dropdown button when menu is open but page is NOT in this group
  const navLinkOpen = 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-slate-600'

  // Dropdown menu item styles (second-level items inside dropdown panels)
  const dropdownItemBase = 'flex items-center px-4 py-2.5 mx-2 rounded-lg text-sm transition-all duration-200 cursor-pointer'
  const dropdownItemActive = 'bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium shadow-md'
  const dropdownItemInactive = 'text-gray-700 dark:text-slate-200 hover:bg-blue-100 dark:hover:bg-slate-600 hover:text-blue-700 dark:hover:text-blue-300'

  const headerRef = useRef<HTMLElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const [dropdownAnchor, setDropdownAnchor] = useState<{ top: number; left: number } | null>(null)

  // Position portaled dropdown under the open menu's trigger (so it isn't clipped by topbar overflow)
  useEffect(() => {
    const ref = portfolioMenuOpen ? portfolioMenuRef : moreMenuOpen ? moreMenuRef : projectsMenuOpen ? projectsMenuRef : financialsMenuOpen ? financialsMenuRef : analysisMenuOpen ? analysisMenuRef : managementMenuOpen ? managementMenuRef : adminMenuOpen ? adminMenuRef : null
    if (!ref?.current) {
      setDropdownAnchor(null)
      return
    }
    const update = () => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect()
        setDropdownAnchor({ top: r.bottom + 12, left: r.left })
      }
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [portfolioMenuOpen, moreMenuOpen, projectsMenuOpen, financialsMenuOpen, analysisMenuOpen, managementMenuOpen, adminMenuOpen])

  return (
    <header ref={headerRef} data-testid="top-bar" className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 w-full max-w-full overflow-visible" style={{ position: 'sticky', top: 0, zIndex: 9999, flexShrink: 0, minHeight: '64px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)' }}>
      <div className="relative flex items-center h-16 px-6 lg:px-8 w-full min-w-0 max-w-full overflow-visible">
        {/* Left + Center: logo, search (always visible), nav (scrolls if needed); reserve space for right actions */}
        <div className="flex items-center flex-1 min-w-0 gap-1 pr-[220px] sm:pr-[260px] overflow-x-auto overflow-y-hidden">
        {/* Left Section: Logo + Menu Button */}
        <div data-testid="top-bar-logo" className="flex items-center space-x-5 flex-shrink-0">
          <button
            data-testid="top-bar-menu-toggle"
            onClick={onMenuToggle}
            className="block lg:hidden p-2.5 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200"
            aria-label={t('topbar.toggleMenu')}
          >
            <Menu className="h-5 w-5 text-gray-700 dark:text-slate-300" />
          </button>
          
          <Link href="/dashboards" className="flex items-center space-x-3 group">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 group-hover:shadow-xl group-hover:shadow-blue-300 transition-all duration-300 group-hover:scale-105">
                <span className="text-white font-bold text-lg">O</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ORKA PPM</span>
                <div className="text-[10px] font-medium text-gray-500 dark:text-slate-400 -mt-1">{t('topbar.portfolioManagement')}</div>
              </div>
            </div>
          </Link>
        </div>

        {/* Portfolio selector – only when user has portfolio_read */}
        {canReadPortfolios && (
          <div className="relative hidden sm:block flex-shrink-0" ref={portfolioMenuRef}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleDropdown(setPortfolioMenuOpen, portfolioMenuOpen) }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${portfolioMenuOpen ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-slate-600' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
              title={t('topbar.currentPortfolio')}
            >
              <FolderOpen className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              <span className="max-w-[140px] truncate">
                {portfolios.length > 0 ? (currentPortfolio?.name ?? t('topbar.allPortfolios')) : t('nav.portfolios')}
              </span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Left-aligned Navigation Links – visible from lg; below lg use the "Menü" dropdown (see after nav) */}
        <nav
          data-testid="top-bar-nav"
          className="hidden lg:flex items-center space-x-1 flex-1 min-w-0"
        >
          {/* Dashboard - Primary Overview */}
          <Link
            href="/dashboards"
            className={`${navLinkBase} ${pathname === '/dashboards' ? navLinkActive : navLinkInactive}`}
            onMouseEnter={() => session?.access_token && prefetchDashboardData(session.access_token, { portfolioId: currentPortfolioId ?? undefined })}
          >
            {t('nav.dashboards')}
          </Link>

          {/* Projects Dropdown */}
          <div className="relative" ref={projectsMenuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleDropdown(setProjectsMenuOpen, projectsMenuOpen) }}
              className={`flex items-center space-x-1 ${navLinkBase} ${
                pathname === '/projects' || pathname.startsWith('/projects/') || pathname === '/resources'
                  ? navLinkActive
                  : projectsMenuOpen
                    ? navLinkOpen
                    : navLinkInactive
              }`}
            >
              <span className="text-inherit">{t('nav.projects')}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

          </div>

          {/* Financials Dropdown */}
          <div className="relative" ref={financialsMenuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleDropdown(setFinancialsMenuOpen, financialsMenuOpen) }}
              onMouseEnter={() => prefetchFinancials(session?.access_token)}
              className={`flex items-center space-x-1 ${navLinkBase} ${
                pathname === '/financials' || pathname.startsWith('/financials/') || pathname === '/reports' || pathname.startsWith('/reports/') || pathname === '/project-controls'
                  ? navLinkActive
                  : financialsMenuOpen
                    ? navLinkOpen
                    : navLinkInactive
              }`}
            >
              <span className="text-inherit">{t('nav.financials')}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

          </div>

          {/* Analysis Dropdown */}
          <div className="relative" ref={analysisMenuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleDropdown(setAnalysisMenuOpen, analysisMenuOpen) }}
              className={`flex items-center space-x-1 ${navLinkBase} ${
                ['/risks', '/registers', '/scenarios', '/monte-carlo', '/audit', '/schedules'].includes(pathname) || pathname.startsWith('/schedules/')
                  ? navLinkActive
                  : analysisMenuOpen
                    ? navLinkOpen
                    : navLinkInactive
              }`}
            >
              <span className="text-inherit">{t('nav.analysis')}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

          </div>

          {/* Management Dropdown */}
          <div className="relative" ref={managementMenuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleDropdown(setManagementMenuOpen, managementMenuOpen) }}
              className={`flex items-center space-x-1 ${navLinkBase} ${
                ['/changes', '/feedback', '/features', '/import'].includes(pathname)
                  ? navLinkActive
                  : managementMenuOpen
                    ? navLinkOpen
                    : navLinkInactive
              }`}
            >
              <span className="text-inherit">{t('nav.management')}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

          </div>

          {/* Admin Dropdown */}
          <div className="relative" ref={adminMenuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); toggleDropdown(setAdminMenuOpen, adminMenuOpen) }}
              className={`flex items-center space-x-1 ${navLinkBase} ${
                ['/admin', '/admin/performance', '/admin/users'].includes(pathname) || pathname.startsWith('/admin/')
                  ? navLinkActive
                  : adminMenuOpen
                    ? navLinkOpen
                    : navLinkInactive
              }`}
            >
              <Shield className="h-4 w-4" />
              <span className="text-inherit">{t('nav.admin')}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

          </div>
        </nav>

        {/* Below lg: "Menü" dropdown with all nav links so user can reach every page */}
        <div className="relative flex lg:hidden flex-shrink-0" ref={moreMenuRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (moreMenuOpen) closeAllDropdowns(); else openMoreMenu() }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${moreMenuOpen ? 'bg-blue-50 dark:bg-slate-700 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-slate-600' : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
            title={t('nav.projects')}
          >
            <Layers className="h-4 w-4 text-gray-500 dark:text-slate-400" />
            <span>{t('nav.projects')}</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Portaled dropdown panels (so they are not clipped by topbar overflow) */}
        {(portfolioMenuOpen || moreMenuOpen || projectsMenuOpen || financialsMenuOpen || analysisMenuOpen || managementMenuOpen || adminMenuOpen) && dropdownAnchor && typeof document !== 'undefined' && createPortal(
          <div
            className="w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-3 animate-in fade-in slide-in-from-top-2 duration-200"
            style={{ position: 'fixed', top: dropdownAnchor.top, left: dropdownAnchor.left, zIndex: 10050, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
          >
            {portfolioMenuOpen && canReadPortfolios && (
              <>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('topbar.currentPortfolio')}</h3>
                </div>
                {portfolios.length > 0 && (
                  <>
                    <button type="button" className={`${dropdownItemBase} w-full text-left ${!currentPortfolioId ? dropdownItemActive : dropdownItemInactive}`} onClick={() => { setCurrentPortfolioId(null); setPortfolioMenuOpen(false); router.push('/portfolios') }}>
                      <FolderOpen className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('topbar.allPortfolios')}</span>
                    </button>
                    {portfolios.map((p) => (
                      <button key={p.id} type="button" className={`${dropdownItemBase} w-full text-left ${currentPortfolioId === p.id ? dropdownItemActive : dropdownItemInactive}`} onClick={() => { setCurrentPortfolioId(p.id); setPortfolioMenuOpen(false); router.push(`/portfolios/${p.id}`) }}>
                        <FolderOpen className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium truncate block">{p.name}</span>
                      </button>
                    ))}
                  </>
                )}
                {portfolios.length === 0 && (
                  <button type="button" className={`${dropdownItemBase} w-full text-left`} onClick={() => { setPortfolioMenuOpen(false); router.push('/portfolios') }}>
                    <Layers className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.portfolios')}</span>
                  </button>
                )}
              </>
            )}
            {moreMenuOpen && (
              <>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.projects')}</h3>
                </div>
                <Link href="/dashboards" className={`${dropdownItemBase} ${pathname === '/dashboards' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <BarChart3 className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.dashboards')}</span>
                </Link>
                <Link href="/projects" className={`${dropdownItemBase} ${pathname === '/projects' || pathname.startsWith('/projects/') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <GitBranch className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.allProjects')}</span>
                </Link>
                {canReadPortfolios && (
                  <Link href="/portfolios" className={`${dropdownItemBase} ${pathname === '/portfolios' || pathname.startsWith('/portfolios/') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                    <FolderOpen className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.portfolios')}</span>
                  </Link>
                )}
                <Link href="/resources" className={`${dropdownItemBase} ${pathname === '/resources' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <Users className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.resourceManagement')}</span>
                </Link>
                <Link href="/financials" className={`${dropdownItemBase} ${pathname === '/financials' || pathname.startsWith('/financials/') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <DollarSign className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.budgetCostTracking')}</span>
                </Link>
                <Link href="/reports" className={`${dropdownItemBase} ${(pathname === '/reports' || pathname.startsWith('/reports/')) && !pathname.startsWith('/reports/pmr') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <FileText className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.reportsAnalytics')}</span>
                </Link>
                <Link href="/risks" className={`${dropdownItemBase} ${pathname === '/risks' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.riskManagement')}</span>
                </Link>
                <Link href="/changes" className={`${dropdownItemBase} ${pathname === '/changes' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <GitPullRequest className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.changeManagement')}</span>
                </Link>
                <Link href="/admin" className={`${dropdownItemBase} ${pathname === '/admin' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setMoreMenuOpen(false)}>
                  <Shield className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.systemAdmin')}</span>
                </Link>
              </>
            )}
            {projectsMenuOpen && (
              <>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.projects')}</h3>
                </div>
                <Link href="/projects" className={`${dropdownItemBase} ${pathname === '/projects' || pathname.startsWith('/projects/') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setProjectsMenuOpen(false)}>
                  <GitBranch className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.allProjects')}</span>
                </Link>
                {canReadPortfolios && (
                  <Link href="/portfolios" className={`${dropdownItemBase} ${pathname === '/portfolios' || pathname.startsWith('/portfolios/') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setProjectsMenuOpen(false)}>
                    <FolderOpen className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.portfolios')}</span>
                  </Link>
                )}
                <Link href="/resources" className={`${dropdownItemBase} ${pathname === '/resources' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setProjectsMenuOpen(false)}>
                  <Users className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.resourceManagement')}</span>
                </Link>
              </>
            )}
            {financialsMenuOpen && (
              <>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.financialManagement')}</h3>
                </div>
                <Link href="/financials" className={`${dropdownItemBase} ${pathname === '/financials' || pathname.startsWith('/financials/') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setFinancialsMenuOpen(false)} onMouseEnter={() => prefetchFinancials(session?.access_token)}>
                  <DollarSign className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.budgetCostTracking')}</span>
                </Link>
                <Link href="/reports" className={`${dropdownItemBase} ${(pathname === '/reports' || pathname.startsWith('/reports/')) && !pathname.startsWith('/reports/pmr') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setFinancialsMenuOpen(false)}>
                  <FileText className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.reportsAnalytics')}</span>
                </Link>
                <Link href="/project-controls" className={`${dropdownItemBase} ${pathname === '/project-controls' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setFinancialsMenuOpen(false)}>
                  <Target className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.projectControls')}</span>
                </Link>
                <Link href="/reports/pmr" className={`${dropdownItemBase} ${pathname === '/reports/pmr' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setFinancialsMenuOpen(false)}>
                  <BookOpen className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.projectMonthlyReport')}</span>
                </Link>
              </>
            )}
            {analysisMenuOpen && (
              <>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.riskAnalysis')}</h3>
                </div>
                <Link href="/risks" className={`${dropdownItemBase} ${pathname === '/risks' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAnalysisMenuOpen(false)}><AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.riskManagement')}</span></Link>
                <Link href="/registers" className={`${dropdownItemBase} ${pathname === '/registers' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAnalysisMenuOpen(false)}><BookOpen className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">Registers</span></Link>
                <Link href="/scenarios" className={`${dropdownItemBase} ${pathname === '/scenarios' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAnalysisMenuOpen(false)}><Layers className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.whatIfScenarios')}</span></Link>
                <Link href="/monte-carlo" className={`${dropdownItemBase} ${pathname === '/monte-carlo' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAnalysisMenuOpen(false)}><BarChart3 className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.monteCarloAnalysis')}</span></Link>
                <Link href="/audit" className={`${dropdownItemBase} ${pathname === '/audit' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAnalysisMenuOpen(false)}><FileText className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.auditTrail')}</span></Link>
                <Link href="/schedules" className={`${dropdownItemBase} ${pathname === '/schedules' || pathname.startsWith('/schedules/') ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAnalysisMenuOpen(false)}><Calendar className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.scheduleManagement')}</span></Link>
              </>
            )}
            {managementMenuOpen && (
              <>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.changeFeedback')}</h3>
                </div>
                <Link href="/changes" className={`${dropdownItemBase} ${pathname === '/changes' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setManagementMenuOpen(false)}><GitPullRequest className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.changeManagement')}</span></Link>
                <Link href="/feedback" className={`${dropdownItemBase} ${pathname === '/feedback' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setManagementMenuOpen(false)}><MessageSquare className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.feedbackIdeas')}</span></Link>
                <Link href="/features" className={`${dropdownItemBase} ${pathname === '/features' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setManagementMenuOpen(false)}><Layers className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.featuresOverview')}</span></Link>
                <Link href="/import" className={`${dropdownItemBase} ${pathname === '/import' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setManagementMenuOpen(false)}><Upload className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.dataImport')}</span></Link>
              </>
            )}
            {adminMenuOpen && (
              <>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.administration')}</h3>
                </div>
                <Link href="/admin" className={`${dropdownItemBase} ${pathname === '/admin' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAdminMenuOpen(false)}><Shield className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.systemAdmin')}</span></Link>
                <Link href="/admin/performance" className={`${dropdownItemBase} ${pathname === '/admin/performance' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAdminMenuOpen(false)}><Activity className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.performanceMonitor')}</span></Link>
                <Link href="/admin/users" className={`${dropdownItemBase} ${pathname === '/admin/users' ? dropdownItemActive : dropdownItemInactive}`} onClick={() => setAdminMenuOpen(false)}><Users className="h-5 w-5 mr-3 flex-shrink-0" /><span className="font-medium">{t('nav.userManagement')}</span></Link>
              </>
            )}
          </div>,
          document.body
        )}

        </div>

        {/* Right Section: search, theme, language, notifications, user – always visible */}
        <div ref={actionsRef} data-testid="top-bar-actions" className="absolute right-0 top-0 bottom-0 flex items-center space-x-2 sm:space-x-3 flex-shrink-0 z-10 pl-4 pr-6 lg:pr-8 bg-white dark:bg-slate-900">
          {/* Topbar Unified Search – directly before theme switcher */}
          <TopbarSearch />
          {/* Theme Toggle (Light / Dark / System) */}
          <button
            data-testid="top-bar-theme-toggle"
            onClick={cycleTheme}
            className="p-2.5 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 group"
            aria-label={theme === 'dark' ? t('topbar.themeDark') : theme === 'system' ? t('topbar.themeSystem') : t('topbar.themeLight')}
            title={theme === 'dark' ? t('topbar.switchThemeSystem') : theme === 'system' ? t('topbar.switchThemeLight') : t('topbar.switchThemeDark')}
          >
            <ThemeIcon className="h-5 w-5 text-gray-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
          </button>

          {/* Language Selector */}
          <GlobalLanguageSelector variant="topbar" />

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              data-testid="top-bar-notifications"
              type="button"
              onClick={() => {
                if (!notificationsOpen) refetchNotifications()
                setNotificationsOpen(!notificationsOpen)
              }}
              className={cn(
                'p-2.5 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 relative group',
                notificationsOpen && 'bg-blue-50 dark:bg-slate-700'
              )}
              aria-label={t('topbar.notifications')}
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-5 w-5 text-gray-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold text-white bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-sm" aria-hidden>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div
                className="absolute right-0 mt-3 w-80 max-h-[min(24rem,70vh)] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col"
                style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
                role="dialog"
                aria-label={t('topbar.notifications')}
              >
                <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('topbar.notifications')}</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllAsRead()}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t('topbar.markAllAsRead')}
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1 min-h-0">
                  {notificationsLoading ? (
                    <p className="px-4 py-6 text-sm text-gray-500 dark:text-slate-400">{t('topbar.searching')}</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500 dark:text-slate-400">{t('topbar.noNotifications')}</p>
                  ) : (
                    <ul className="py-1">
                      {notifications.map((n) => {
                        const isUnread = !(n.is_read ?? n.read)
                        return (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => {
                                if (isUnread) markAsRead(n.id)
                                const url = n.data?.url as string | undefined
                                if (url) router.push(url)
                                setNotificationsOpen(false)
                              }}
                              className={cn(
                                'w-full text-left px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 last:border-0 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors',
                                isUnread && 'bg-blue-50/50 dark:bg-slate-700/50'
                              )}
                            >
                              <p className={cn('text-sm truncate', isUnread ? 'font-semibold text-gray-900 dark:text-slate-100' : 'text-gray-700 dark:text-slate-300')}>
                                {n.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                                {formatNotificationTime(n.created_at, t)}
                              </p>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI Help Chat */}
          <button
            data-testid="top-bar-help-chat"
            type="button"
            onClick={toggleChat}
            className={cn(
              'p-2.5 rounded-lg transition-all duration-200 relative group',
              'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700 dark:hover:to-slate-600',
              helpState.isOpen && 'bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400',
              hasUnreadTips && !helpState.isOpen && 'ring-2 ring-amber-400/60'
            )}
            aria-label={getToggleButtonText()}
            title={getToggleButtonText()}
          >
            {helpState.isOpen ? (
              <PanelRightClose className="h-5 w-5 text-gray-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            ) : hasUnreadTips ? (
              <Lightbulb className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            ) : (
              <MessageSquare className="h-5 w-5 text-gray-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            )}
            {hasUnreadTips && !helpState.isOpen && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full border border-white dark:border-slate-800" aria-hidden />
            )}
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              data-testid="top-bar-user-menu"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-xl transition-all duration-200 group"
              aria-label={t('topbar.userMenu')}
            >
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-lg flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-900/30 group-hover:shadow-lg group-hover:shadow-blue-300 dark:group-hover:shadow-blue-900/50 transition-all duration-200 group-hover:scale-105">
                <span className="text-white text-sm font-semibold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 hidden sm:block transition-colors" />
            </button>

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                   style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
                      <span className="text-white text-sm font-semibold">
                        {userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">{userName}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{userEmail}</p>
                    </div>
                  </div>
                </div>
                
                <div className="py-2">
                  <Link
                    href="/admin/users"
                    className={`${dropdownItemBase} ${dropdownItemInactive}`}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="font-medium">{t('nav.profileSettings')}</span>
                  </Link>
                  
                  <Link
                    href="/settings"
                    className={`${dropdownItemBase} ${dropdownItemInactive}`}
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="font-medium">{t('nav.settings')}</span>
                  </Link>

                  <div className="sm:hidden px-2 py-2">
                    <GlobalLanguageSelector variant="dropdown" />
                  </div>

                  <div className="border-t border-gray-100 dark:border-slate-700 my-2"></div>

                  <button
                    data-testid="top-bar-logout"
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2.5 mx-2 rounded-lg text-sm text-red-800 dark:text-red-400 hover:bg-red-100/80 dark:hover:bg-red-900/40 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200"
                  >
                    <LogOut className="h-5 w-5 mr-3 flex-shrink-0" />
                    <span className="font-medium">{t('nav.logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
