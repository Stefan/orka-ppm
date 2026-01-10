'use client'

import React, { useEffect, useState } from 'react'
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

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024) // lg breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
            
            <div className="flex h-screen bg-gray-50">
              {/* Desktop Sidebar */}
              <Sidebar isOpen={!isMobile} />
              
              {/* Mobile Sidebar */}
              {isMobile && (
                <Sidebar 
                  isOpen={sidebarOpen} 
                  onToggle={() => setSidebarOpen(!sidebarOpen)}
                  isMobile={true}
                />
              )}
              
              {/* Main Content */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile Header */}
                {isMobile && (
                  <header 
                    className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:hidden"
                    role="banner"
                    aria-label="Mobile header"
                  >
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      aria-label="Open navigation menu"
                      aria-expanded={sidebarOpen}
                      aria-controls="navigation"
                    >
                      <Menu className="h-6 w-6" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900">PPM Dashboard</h1>
                    <div className="w-10" /> {/* Spacer for centering */}
                  </header>
                )}
                
                {/* Main Content Area */}
                <main 
                  id="main-content"
                  className="flex-1 overflow-auto"
                  role="main"
                  aria-label="Main content"
                  tabIndex={-1}
                >
                  {children}
                </main>
              </div>

              {/* Help Chat Integration - Proper z-index layering */}
              {/* Help Chat: z-40 for desktop sidebar, z-50 for mobile overlay */}
              <HelpChat />
              {/* Help Chat Toggle: z-30 to stay below chat but above main content */}
              <HelpChatToggle />
              {/* Proactive Tips: z-45 to stay above main content but below help chat */}
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