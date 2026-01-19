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
  AlertTriangle,
  BarChart3,
  GitPullRequest,
  MessageSquare,
  Activity,
  Users
} from 'lucide-react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { GlobalLanguageSelector } from './GlobalLanguageSelector'
import { useLanguage } from '@/hooks/useLanguage'
import { useTranslations } from '@/lib/i18n/context'

export interface TopBarProps {
  onMenuToggle?: () => void
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, clearSession } = useAuth()
  const { currentLanguage } = useLanguage()
  const { t } = useTranslations()
  
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)

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
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false)
      }
    }

    if (userMenuOpen || moreMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [userMenuOpen, moreMenuOpen])

  const userEmail = session?.user?.email || 'User'
  const userName = session?.user?.user_metadata?.full_name || userEmail.split('@')[0]

  return (
    <header className="bg-white border-b border-gray-200 w-full shadow-sm" style={{ position: 'sticky', top: 0, zIndex: 9999, flexShrink: 0, minHeight: '56px' }}>
      <div className="flex items-center justify-between h-14 px-4 lg:px-6 w-full">
        {/* Left Section: Logo + Menu Button */}
        <div className="flex items-center space-x-4 flex-shrink-0">
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            style={{ display: showNav ? 'none' : 'block' }}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5 text-gray-700" />
          </button>
          
          <Link href="/dashboards" className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">O</span>
              </div>
              <span className="text-lg font-semibold text-gray-900 hidden sm:inline">ORKA PPM</span>
            </div>
          </Link>
        </div>

        {/* Center Section: Navigation Links */}
        <nav 
          className="items-center space-x-1 flex-1 justify-center"
          style={{ 
            display: showNav ? 'flex' : 'none'
          }}
        >
          <Link
            href="/dashboards"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/dashboards'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t('nav.dashboards')}
          </Link>
          <Link
            href="/scenarios"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/scenarios'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t('nav.scenarios')}
          </Link>
          <Link
            href="/resources"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/resources'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t('nav.resources')}
          </Link>
          <Link
            href="/reports"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/reports'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t('nav.reports')}
          </Link>
          <Link
            href="/financials"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              pathname === '/financials'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {t('nav.financials')}
          </Link>

          {/* More Menu Dropdown */}
          <div className="relative" ref={moreMenuRef}>
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                moreMenuOpen || ['/risks', '/monte-carlo', '/changes', '/feedback', '/admin/performance', '/admin/users'].includes(pathname)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span>{t('nav.more')}</span>
            </button>

            {/* More Dropdown Menu */}
            {moreMenuOpen && (
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                <Link
                  href="/risks"
                  className={`flex items-center px-3 py-2 mx-2 rounded-lg text-sm transition-all ${
                    pathname === '/risks'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <AlertTriangle className="h-4 w-4 mr-3 flex-shrink-0" />
                  {t('nav.risks')}
                </Link>
                <Link
                  href="/monte-carlo"
                  className={`flex items-center px-3 py-2 mx-2 rounded-lg text-sm transition-all ${
                    pathname === '/monte-carlo'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <BarChart3 className="h-4 w-4 mr-3 flex-shrink-0" />
                  {t('nav.monteCarlo')}
                </Link>
                <Link
                  href="/changes"
                  className={`flex items-center px-3 py-2 mx-2 rounded-lg text-sm transition-all ${
                    pathname === '/changes'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <GitPullRequest className="h-4 w-4 mr-3 flex-shrink-0" />
                  Change Management
                </Link>
                <Link
                  href="/feedback"
                  className={`flex items-center px-3 py-2 mx-2 rounded-lg text-sm transition-all ${
                    pathname === '/feedback'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <MessageSquare className="h-4 w-4 mr-3 flex-shrink-0" />
                  Feedback & Ideas
                </Link>
                
                <div className="border-t border-gray-200 my-2 mx-2"></div>
                
                <Link
                  href="/admin/performance"
                  className={`flex items-center px-3 py-2 mx-2 rounded-lg text-sm transition-all ${
                    pathname === '/admin/performance'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <Activity className="h-4 w-4 mr-3 flex-shrink-0" />
                  Performance Monitor
                </Link>
                <Link
                  href="/admin/users"
                  className={`flex items-center px-3 py-2 mx-2 rounded-lg text-sm transition-all ${
                    pathname === '/admin/users'
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <Users className="h-4 w-4 mr-3 flex-shrink-0" />
                  User Management
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Right Section: Language, Notifications, User Menu */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          {/* Language Selector */}
          <GlobalLanguageSelector variant="topbar" />

          {/* Notifications */}
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-600 hidden sm:block" />
            </button>

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
                  <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                </div>
                
                <Link
                  href="/admin/users"
                  className="flex items-center px-3 py-2 mx-2 mt-2 rounded-lg text-sm text-gray-900 hover:bg-gray-50 transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <User className="h-4 w-4 mr-3 flex-shrink-0" />
                  Profile Settings
                </Link>

                <div className="sm:hidden border-t border-gray-100 mt-2 pt-2 mx-2">
                  <GlobalLanguageSelector variant="dropdown" />
                </div>

                <div className="border-t border-gray-100 mt-2 pt-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-3 py-2 mx-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-3 flex-shrink-0" />
                    Logout
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
