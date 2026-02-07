'use client'

import { useState, useRef, useEffect } from 'react'
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
} from 'lucide-react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { useTheme } from '@/app/providers/ThemeProvider'
import { prefetchDashboardData } from '@/lib/api/dashboard-loader'
import { prefetchFinancials } from '@/lib/api/prefetch'
import { useHelpChat } from '@/hooks/useHelpChat'
import { GlobalLanguageSelector } from './GlobalLanguageSelector'
import { useLanguage } from '@/hooks/useLanguage'
import { useTranslations } from '@/lib/i18n/context'
import TopbarSearch from './TopbarSearch'
import { cn } from '@/lib/utils/design-system'

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
  
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [projectsMenuOpen, setProjectsMenuOpen] = useState(false)
  const [financialsMenuOpen, setFinancialsMenuOpen] = useState(false)
  const [analysisMenuOpen, setAnalysisMenuOpen] = useState(false)
  const [managementMenuOpen, setManagementMenuOpen] = useState(false)
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const projectsMenuRef = useRef<HTMLDivElement>(null)
  const financialsMenuRef = useRef<HTMLDivElement>(null)
  const analysisMenuRef = useRef<HTMLDivElement>(null)
  const managementMenuRef = useRef<HTMLDivElement>(null)
  const adminMenuRef = useRef<HTMLDivElement>(null)

  // Handle responsive navigation
  useEffect(() => {
    const handleResize = () => {
      setShowNav(window.innerWidth >= 768)
    }
    
    handleResize() // Initial check
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }

    if (projectsMenuOpen || financialsMenuOpen || analysisMenuOpen || managementMenuOpen || adminMenuOpen || userMenuOpen || moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [projectsMenuOpen, financialsMenuOpen, analysisMenuOpen, managementMenuOpen, adminMenuOpen, userMenuOpen, moreMenuOpen])

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
    setProjectsMenuOpen(false)
    setFinancialsMenuOpen(false)
    setAnalysisMenuOpen(false)
    setManagementMenuOpen(false)
    setAdminMenuOpen(false)
    setUserMenuOpen(false)
    setMoreMenuOpen(false)
  }

  // Toggle a specific dropdown, closing all others first
  const toggleDropdown = (setter: React.Dispatch<React.SetStateAction<boolean>>, current: boolean) => {
    closeAllDropdowns()
    // Use setTimeout to ensure close happens before open
    if (!current) {
      setter(true)
    }
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

  return (
    <header data-testid="top-bar" className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 w-full" style={{ position: 'sticky', top: 0, zIndex: 9999, flexShrink: 0, minHeight: '64px', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between h-16 px-6 lg:px-8 w-full">
        {/* Left Section: Logo + Menu Button */}
        <div data-testid="top-bar-logo" className="flex items-center space-x-5 flex-shrink-0">
          <button
            data-testid="top-bar-menu-toggle"
            onClick={onMenuToggle}
            className="p-2.5 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200"
            style={{ display: showNav ? 'none' : 'block' }}
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

        {/* Left-aligned Navigation Links */}
        <nav
          data-testid="top-bar-nav"
          className="items-center space-x-1 flex-1"
          style={{
            display: showNav ? 'flex' : 'none'
          }}
        >
          {/* Dashboard - Primary Overview */}
          <Link
            href="/dashboards"
            className={`${navLinkBase} ${pathname === '/dashboards' ? navLinkActive : navLinkInactive}`}
            onMouseEnter={() => session?.access_token && prefetchDashboardData(session.access_token)}
          >
            {t('nav.dashboards')}
          </Link>

          {/* Projects Dropdown */}
          <div className="relative" ref={projectsMenuRef}>
            <button
              onClick={() => toggleDropdown(setProjectsMenuOpen, projectsMenuOpen)}
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

            {/* Projects Dropdown Menu */}
            {projectsMenuOpen && (
              <div
                className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
              >
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.projects')}</h3>
                </div>
                <Link
                  href="/projects"
                  className={`${dropdownItemBase} ${
                    pathname === '/projects' || pathname.startsWith('/projects/')
                      ? dropdownItemActive
                      : dropdownItemInactive
                  }`}
                  onClick={() => setProjectsMenuOpen(false)}
                >
                  <GitBranch className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.allProjects')}</span>
                </Link>
                <Link
                  href="/resources"
                  className={`${dropdownItemBase} ${
                    pathname === '/resources'
                      ? dropdownItemActive
                      : dropdownItemInactive
                  }`}
                  onClick={() => setProjectsMenuOpen(false)}
                >
                  <Users className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.resourceManagement')}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Financials Dropdown */}
          <div className="relative" ref={financialsMenuRef}>
            <button
              onClick={() => toggleDropdown(setFinancialsMenuOpen, financialsMenuOpen)}
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

            {/* Financials Dropdown Menu */}
            {financialsMenuOpen && (
              <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                   style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.financialManagement')}</h3>
                </div>
                <Link
                  href="/financials"
                  className={`${dropdownItemBase} ${
                    pathname === '/financials' || pathname.startsWith('/financials/')
                      ? dropdownItemActive
                      : dropdownItemInactive
                  }`}
                  onClick={() => setFinancialsMenuOpen(false)}
                  onMouseEnter={() => prefetchFinancials(session?.access_token)}
                >
                  <DollarSign className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.budgetCostTracking')}</span>
                </Link>
                <Link
                  href="/reports"
                  className={`${dropdownItemBase} ${
                    (pathname === '/reports' || pathname.startsWith('/reports/')) && !pathname.startsWith('/reports/pmr')
                      ? dropdownItemActive
                      : dropdownItemInactive
                  }`}
                  onClick={() => setFinancialsMenuOpen(false)}
                >
                  <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.reportsAnalytics')}</span>
                </Link>
                <Link
                  href="/project-controls"
                  className={`${dropdownItemBase} ${
                    pathname === '/project-controls'
                      ? dropdownItemActive
                      : dropdownItemInactive
                  }`}
                  onClick={() => setFinancialsMenuOpen(false)}
                >
                  <Target className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.projectControls')}</span>
                </Link>
                <Link
                  href="/reports/pmr"
                  className={`${dropdownItemBase} ${
                    pathname === '/reports/pmr'
                      ? dropdownItemActive
                      : dropdownItemInactive
                  }`}
                  onClick={() => setFinancialsMenuOpen(false)}
                >
                  <BookOpen className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.projectMonthlyReport')}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Analysis Dropdown */}
          <div className="relative" ref={analysisMenuRef}>
            <button
              onClick={() => toggleDropdown(setAnalysisMenuOpen, analysisMenuOpen)}
              className={`flex items-center space-x-1 ${navLinkBase} ${
                ['/risks', '/scenarios', '/monte-carlo', '/audit', '/schedules'].includes(pathname) || pathname.startsWith('/schedules/')
                  ? navLinkActive
                  : analysisMenuOpen
                    ? navLinkOpen
                    : navLinkInactive
              }`}
            >
              <span className="text-inherit">{t('nav.analysis')}</span>
              <ChevronDown className="h-4 w-4" />
            </button>

            {/* Analysis Dropdown Menu */}
            {analysisMenuOpen && (
              <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                   style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.riskAnalysis')}</h3>
                </div>
                <Link
                  href="/risks"
                  className={`${dropdownItemBase} ${pathname === '/risks' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAnalysisMenuOpen(false)}
                >
                  <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.riskManagement')}</span>
                </Link>
                <Link
                  href="/scenarios"
                  className={`${dropdownItemBase} ${pathname === '/scenarios' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAnalysisMenuOpen(false)}
                >
                  <Layers className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.whatIfScenarios')}</span>
                </Link>
                <Link
                  href="/monte-carlo"
                  className={`${dropdownItemBase} ${pathname === '/monte-carlo' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAnalysisMenuOpen(false)}
                >
                  <BarChart3 className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.monteCarloAnalysis')}</span>
                </Link>
                <Link
                  href="/audit"
                  className={`${dropdownItemBase} ${pathname === '/audit' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAnalysisMenuOpen(false)}
                >
                  <FileText className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.auditTrail')}</span>
                </Link>
                <Link
                  href="/schedules"
                  className={`${dropdownItemBase} ${pathname === '/schedules' || pathname.startsWith('/schedules/') ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAnalysisMenuOpen(false)}
                >
                  <Calendar className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.scheduleManagement')}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Management Dropdown */}
          <div className="relative" ref={managementMenuRef}>
            <button
              onClick={() => toggleDropdown(setManagementMenuOpen, managementMenuOpen)}
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

            {/* Management Dropdown Menu */}
            {managementMenuOpen && (
              <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                   style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.changeFeedback')}</h3>
                </div>
                <Link
                  href="/changes"
                  className={`${dropdownItemBase} ${pathname === '/changes' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setManagementMenuOpen(false)}
                >
                  <GitPullRequest className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.changeManagement')}</span>
                </Link>
                <Link
                  href="/feedback"
                  className={`${dropdownItemBase} ${pathname === '/feedback' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setManagementMenuOpen(false)}
                >
                  <MessageSquare className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.feedbackIdeas')}</span>
                </Link>
                <Link
                  href="/features"
                  className={`${dropdownItemBase} ${pathname === '/features' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setManagementMenuOpen(false)}
                >
                  <Layers className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.featuresOverview')}</span>
                </Link>
                <Link
                  href="/import"
                  className={`${dropdownItemBase} ${pathname === '/import' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setManagementMenuOpen(false)}
                >
                  <Upload className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.dataImport')}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Admin Dropdown */}
          <div className="relative" ref={adminMenuRef}>
            <button
              onClick={() => toggleDropdown(setAdminMenuOpen, adminMenuOpen)}
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

            {/* Admin Dropdown Menu */}
            {adminMenuOpen && (
              <div className="absolute left-0 mt-3 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                   style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                <div className="px-3 pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">{t('nav.administration')}</h3>
                </div>
                <Link
                  href="/admin"
                  className={`${dropdownItemBase} ${pathname === '/admin' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAdminMenuOpen(false)}
                >
                  <Shield className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.systemAdmin')}</span>
                </Link>
                <Link
                  href="/admin/performance"
                  className={`${dropdownItemBase} ${pathname === '/admin/performance' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAdminMenuOpen(false)}
                >
                  <Activity className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.performanceMonitor')}</span>
                </Link>
                <Link
                  href="/admin/users"
                  className={`${dropdownItemBase} ${pathname === '/admin/users' ? dropdownItemActive : dropdownItemInactive}`}
                  onClick={() => setAdminMenuOpen(false)}
                >
                  <Users className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="font-medium">{t('nav.userManagement')}</span>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Topbar Unified Search */}
        <TopbarSearch />

        {/* Right Section: Theme, Language, Notifications, User Menu */}
        <div data-testid="top-bar-actions" className="flex items-center space-x-3 flex-shrink-0">
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
          <button
            data-testid="top-bar-notifications"
            className="p-2.5 rounded-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 relative group"
            aria-label={t('topbar.notifications')}
          >
            <Bell className="h-5 w-5 text-gray-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-sm animate-pulse"></span>
          </button>

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
