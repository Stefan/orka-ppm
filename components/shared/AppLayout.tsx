'use client'

import React, { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { HelpChatProvider } from '../../app/providers/HelpChatProvider'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import Sidebar from '../navigation/Sidebar'
import HelpChatToggle from '../HelpChatToggle'
import { useIsMobile } from '../../hooks/useMediaQuery'

// Lazy load HelpChat for better performance
const HelpChat = lazy(() => import('../HelpChat'))

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
      <div className="flex h-screen bg-white">
        {/* Sidebar - Fixed position on desktop */}
        <Sidebar 
          isOpen={isMobile ? sidebarOpen : true} 
          onToggle={toggleSidebar}
          isMobile={isMobile}
        />
        
        {/* Main Content - With left margin for fixed sidebar on desktop */}
        <div 
          className="flex-1 flex flex-col min-w-0"
          style={{
            marginLeft: isMobile ? 0 : '256px' // 256px = w-64
          }}
        >
          {/* Mobile Header with Menu Button */}
          {isMobile && (
            <header className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center">
              <button
                onClick={toggleSidebar}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Menu className="h-6 w-6 text-gray-600" />
              </button>
              <h1 className="ml-3 text-lg font-semibold text-gray-900">PPM Dashboard</h1>
            </header>
          )}
          
          {/* Main Content Area */}
          <main 
            ref={mainContentRef}
            className="flex-1 bg-white overflow-auto"
          >
            {children}
          </main>
        </div>

        {/* Help Chat Toggle - Floating at bottom-left to avoid collisions */}
        <HelpChatToggle />

        {/* Help Chat Integration - Lazy loaded */}
        <Suspense fallback={null}>
          <HelpChat />
        </Suspense>
      </div>
    </HelpChatProvider>
  )
}