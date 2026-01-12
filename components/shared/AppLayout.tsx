'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { HelpChatProvider } from '../../app/providers/HelpChatProvider'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import Sidebar from '../navigation/Sidebar'
import HelpChat from '../HelpChat'
import HelpChatToggle from '../HelpChatToggle'
import ProactiveTips from '../onboarding/ProactiveTips'
import KeyboardNavigation, { FocusIndicator } from '../accessibility/KeyboardNavigation'
import LandmarkNavigation, { SkipLink } from '../accessibility/LandmarkNavigation'
import { AnnouncementManager } from '../accessibility/ScreenReaderSupport'
import { AccessibilityProvider } from '../accessibility/AccessibilityThemes'
import ColorBlindnessFilters from '../accessibility/ColorBlindnessFilters'
import { useScrollPerformance } from '../../hooks/useScrollPerformance'
import { useIsMobile } from '../../hooks/useMediaQuery'

export interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const mainContentRef = useRef<HTMLElement>(null)
  
  // Mobile sidebar state management
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Toggle function for mobile sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  // Initialize scroll performance monitoring
  const {
    performanceSummary,
    isScrolling
  } = useScrollPerformance({
    elementRef: mainContentRef,
    enableMetrics: true,
    enableOptimizations: true,
    debugMode: process.env.NODE_ENV === 'development',
    onScrollStart: () => {
      // Optional: Add scroll start optimizations
      if (process.env.NODE_ENV === 'development') {
        console.log('Scroll started - performance monitoring active')
      }
    },
    onScrollEnd: () => {
      // Optional: Log scroll performance
      if (process.env.NODE_ENV === 'development') {
        console.log('Scroll performance summary:', performanceSummary)
      }
    }
  })

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
          <p className="text-gray-600 mb-4">Redirecting to login...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <HelpChatProvider>
      <AccessibilityProvider>
        <KeyboardNavigation>
          <FocusIndicator>
            <LandmarkNavigation>
              <AnnouncementManager />
              <ColorBlindnessFilters />
              {/* Skip Links */}
              <SkipLink href="#main-content">Skip to main content</SkipLink>
              <SkipLink href="#navigation">Skip to navigation</SkipLink>
            
            <div className="flex h-screen bg-white layout-optimized">
              {/* Sidebar */}
              <Sidebar 
                isOpen={isMobile ? sidebarOpen : true} 
                onToggle={toggleSidebar}
                isMobile={isMobile}
              />
              
              {/* Main Content */}
              <div className="flex-1 flex flex-col min-w-0 layout-optimized">
                {/* Mobile Header with Menu Button */}
                {isMobile && (
                  <header className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center layout-stable">
                    <button
                      onClick={toggleSidebar}
                      className="p-2 rounded-md hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center hover-optimized focus-optimized"
                      aria-label="Open navigation menu"
                      aria-expanded={sidebarOpen}
                      aria-controls="navigation"
                    >
                      <Menu className="h-6 w-6 text-gray-600" />
                    </button>
                    <h1 className="ml-3 text-lg font-semibold text-gray-900 text-optimized">PPM Dashboard</h1>
                  </header>
                )}
                
                {/* Main Content Area */}
                <main 
                  ref={mainContentRef}
                  id="main-content"
                  className={`flex-1 min-h-screen bg-white overflow-auto scrollable-container scroll-boundary-fix content-scroll-area dashboard-scroll main-content-optimized dashboard-performance performance-critical ${isScrolling ? 'scrolling' : ''} ${isMobile ? 'mobile-performance' : ''}`}
                  role="main"
                  aria-label="Main content"
                  tabIndex={-1}
                  style={{
                    // Additional scroll performance optimizations
                    transform: 'translateZ(0)',
                    willChange: isScrolling ? 'scroll-position' : 'auto',
                    overscrollBehavior: 'contain',
                    WebkitOverflowScrolling: 'touch',
                    // Performance optimizations
                    contain: 'layout style paint',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden'
                  }}
                >
                  {children}
                </main>
              </div>

              {/* Help Chat Integration */}
              <HelpChat />
              <HelpChatToggle />
              <ProactiveTips 
                position="bottom-right"
                maxVisible={3}
                autoHide={false}
              />
            </div>
          </LandmarkNavigation>
        </FocusIndicator>
      </KeyboardNavigation>
      </AccessibilityProvider>
    </HelpChatProvider>
  )
}