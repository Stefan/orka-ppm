'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { HelpChatProvider } from '../../app/providers/HelpChatProvider'
import { useRouter } from 'next/navigation'
import TopBar from '../navigation/TopBar'
import MobileNav from '../navigation/MobileNav'
import HelpChatToggle from '../HelpChatToggle'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useTranslations } from '@/lib/i18n/context'

// Import HelpChat directly to prevent CLS (layout shift)
import HelpChat from '../HelpChat'

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{t('layout.redirecting')}</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <HelpChatProvider>
      <div data-testid="app-layout" className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Bar Navigation */}
        <TopBar onMenuToggle={toggleMobileNav} />
        
        {/* Mobile Navigation Drawer */}
        <MobileNav isOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        
        {/* Main Content Area */}
        <main
          data-testid="app-layout-main"
          ref={mainContentRef}
          className="flex-1"
          style={{
            // CSS containment for better performance isolation and CLS prevention
            contain: 'layout style paint'
          }}
        >
          {children}
        </main>

        {/* Help Chat Toggle - Floating at bottom-right */}
        <HelpChatToggle />

        {/* Help Chat Integration - Always rendered to prevent CLS */}
        <HelpChat />
      </div>
    </HelpChatProvider>
  )
}