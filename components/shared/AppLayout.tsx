'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { HelpChatProvider } from '../../app/providers/HelpChatProvider'
import { useRouter } from 'next/navigation'
import TopBar from '../navigation/TopBar'
import MobileNav from '../navigation/MobileNav'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslations } from '@/lib/i18n/context'

// Import HelpChat directly to prevent CLS (layout shift)
import HelpChat from '../HelpChat'
// DarkModeForcer removed: it set inline styles on every DOM node which prevented
// light mode from working. CSS-based theming (Tailwind dark: variants + CSS custom
// properties in @layer base) handles dark mode correctly without JS overrides.

export interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const mainContentRef = useRef<HTMLElement>(null)
  const { t } = useTranslations()
  // Mobile navigation state management
  const isMobile = useIsMobile()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  
  // Toggle function for mobile navigation
  const toggleMobileNav = () => {
    setMobileNavOpen(!mobileNavOpen)
  }

  useEffect(() => {
    if (!loading && !session) {
      console.log('🔒 No session found, redirecting to login...')
      router.push('/')
    }
  }, [session, loading, router])

  // #region agent log
  useEffect(() => {
    const el = mainContentRef.current
    if (!el) return
    const log = () => {
      const cs = getComputedStyle(el)
      fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AppLayout.tsx:main', message: 'main content metrics', data: { offsetHeight: el.offsetHeight, clientHeight: el.clientHeight, minHeight: cs.minHeight, flex: cs.flex, contain: cs.contain }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H1' }) }).catch(() => {})
      fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AppLayout.tsx:main', message: 'main content metrics', data: { offsetHeight: el.offsetHeight, clientHeight: el.clientHeight, minHeight: cs.minHeight, flex: cs.flex, contain: cs.contain }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H2' }) }).catch(() => {})
      fetch('http://127.0.0.1:7242/ingest/a1af679c-bb9d-43c7-9ee8-d70e9c7bbea1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'AppLayout.tsx:main', message: 'main content metrics', data: { offsetHeight: el.offsetHeight, clientHeight: el.clientHeight, minHeight: cs.minHeight, flex: cs.flex, contain: cs.contain }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'H3' }) }).catch(() => {})
    }
    log()
    const ro = new ResizeObserver(log)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // #endregion

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-4">{t('layout.redirecting')}</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <HelpChatProvider>
      <div data-testid="app-layout" className="min-h-screen bg-white dark:bg-slate-900 flex flex-col">
        {/* Top Bar Navigation */}
        <TopBar onMenuToggle={toggleMobileNav} />
        
        {/* Mobile Navigation Drawer */}
        <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        
        {/* Main Content Area */}
        <main
          data-testid="app-layout-main"
          ref={mainContentRef}
          className="flex-1 min-h-0"
          style={{
            // CSS containment for better performance isolation and CLS prevention
            contain: 'layout style paint'
          }}
        >
          {children}
        </main>

        {/* Help Chat: toggle is in TopBar (right of notifications, left of user menu); panel always rendered to prevent CLS */}
        <HelpChat />
      </div>
    </HelpChatProvider>
  )
}