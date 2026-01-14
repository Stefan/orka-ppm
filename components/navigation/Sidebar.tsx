'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Activity, MessageSquare, X, Users, BarChart3 } from 'lucide-react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { 
  chromeScrollPerformanceManager, 
  CHROME_SCROLL_CLASSES,
  isChromeBasedBrowser 
} from '../../lib/utils/chrome-scroll-performance'
import { 
  getSidebarClasses, 
  getSidebarStyles, 
  logBrowserInfo 
} from '../../lib/utils/browser-detection'
import { 
  applyScrollPerformanceOptimization,
  getScrollPerformanceClasses 
} from '../../lib/utils/performance-optimization'

export interface SidebarProps {
  isOpen?: boolean
  onToggle?: () => void
  isMobile?: boolean
}

export default function Sidebar({ isOpen = true, onToggle, isMobile = false }: SidebarProps) {
  const router = useRouter()
  const { clearSession } = useAuth()
  const sidebarRef = useRef<HTMLElement>(null)
  
  // NEU: Browser detection state
  const [isChrome, setIsChrome] = useState(false)
  const [isFirefox, setIsFirefox] = useState(false)
  const [isSafari, setIsSafari] = useState(false)

  // NEU: Initialize browser detection on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const chrome = isChromeBasedBrowser()
    const firefox = /Firefox/.test(navigator.userAgent)
    const safari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)
    
    setIsChrome(chrome)
    setIsFirefox(firefox)
    setIsSafari(safari)
    
    console.log('🌐 Browser detected:', { isChrome: chrome, isFirefox: firefox, isSafari: safari })
  }, [])

  useEffect(() => {
    const sidebarElement = sidebarRef.current
    if (!sidebarElement) return

    // Log browser information for debugging
    logBrowserInfo()

    // NEU: Non-Chrome browser display fix for desktop (Firefox, Safari, Edge)
    if (!isChrome && !isMobile) {
      const fixNonChromeDisplay = () => {
        if (window.innerWidth >= 1024) {
          // Force display flex for non-Chrome browsers on desktop
          sidebarElement.style.display = 'flex'
          sidebarElement.style.flexDirection = 'column'
          sidebarElement.classList.remove('hidden')
          
          const browserName = isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Non-Chrome'
          console.log(`🌐 ${browserName}: Sidebar display forced to flex`)
        }
      }
      
      // Apply fix immediately and on resize
      fixNonChromeDisplay()
      window.addEventListener('resize', fixNonChromeDisplay)
      
      // Cleanup
      return () => {
        window.removeEventListener('resize', fixNonChromeDisplay)
      }
    }

    // CONDITIONAL: Only apply Chrome optimizations if browser is Chrome-based
    if (isChrome) {
      // Apply Chrome-specific optimizations only for Chrome-based browsers
      chromeScrollPerformanceManager.applyChromeOptimizations(sidebarElement)
      const cleanup = chromeScrollPerformanceManager.initializeChromeScrollHandling(sidebarElement)
      
      // Apply cross-browser scroll performance optimizations
      applyScrollPerformanceOptimization(sidebarElement, {
        enableSmoothScroll: true,
        enableOverscrollBehavior: true,
        enableTouchAction: true,
        enableMomentumScrolling: true
      })
      
      return cleanup
    } else {
      // For non-Chrome browsers (Firefox, Safari, etc.), only apply cross-browser optimizations
      applyScrollPerformanceOptimization(sidebarElement, {
        enableSmoothScroll: true,
        enableOverscrollBehavior: true,
        enableTouchAction: true,
        enableMomentumScrolling: true
      })
      
      // No cleanup needed for non-Chrome browsers
      return () => {}
    }
  }, [isOpen, isChrome, isFirefox, isSafari, isMobile])

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

  const handleLinkClick = () => {
    if (isMobile && onToggle) {
      onToggle()
    }
  }

  // Mobile overlay
  if (isMobile && isOpen) {
    // CONDITIONAL: Get Chrome-specific classes only if browser is Chrome-based
    const chromeClasses = isChrome ? `${CHROME_SCROLL_CLASSES.SIDEBAR_SCROLL_OPTIMIZED} ${CHROME_SCROLL_CLASSES.SIDEBAR_BACKGROUND_CONSISTENCY} ${CHROME_SCROLL_CLASSES.SIDEBAR_SCROLL_STATE_BACKGROUND} ${CHROME_SCROLL_CLASSES.SIDEBAR_MOMENTUM_ARTIFACT_PREVENTION} ${CHROME_SCROLL_CLASSES.PERFORMANCE} ${CHROME_SCROLL_CLASSES.CONTAINER_PERFORMANCE} ${CHROME_SCROLL_CLASSES.MOBILE_PERFORMANCE}` : ''
    
    // CONDITIONAL: Get Chrome-specific inline styles only if browser is Chrome-based
    const chromeStyles = isChrome ? {
      WebkitOverflowScrolling: 'touch' as const,
      overscrollBehavior: 'contain' as const,
      overscrollBehaviorY: 'contain' as const,
      willChange: 'scroll-position, transform',
      contain: 'layout style paint',
      backgroundAttachment: 'local' as const,
      backgroundImage: 'linear-gradient(to bottom, #1f2937 0%, #1f2937 100%)'
    } : {}
    
    // NEU: Non-Chrome browser styles for mobile (Firefox, Safari, etc.)
    const nonChromeStyles = !isChrome ? {
      scrollbarWidth: isFirefox ? ('thin' as const) : undefined,
      scrollbarColor: isFirefox ? 'rgba(155, 155, 155, 0.5) transparent' : undefined,
      WebkitOverflowScrolling: isSafari ? ('touch' as const) : undefined
    } : {}
    
    return (
      <>
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
        
        <nav 
          ref={sidebarRef}
          id="navigation"
          className={`fixed left-0 top-0 h-full w-64 bg-gray-800 text-white flex flex-col z-50 lg:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto sidebar-optimized animation-optimized modal-optimized ${getSidebarClasses(true)} ${getScrollPerformanceClasses()} ${chromeClasses}`}
          style={{
            ...getSidebarStyles(),
            ...chromeStyles,
            ...nonChromeStyles,
            backgroundColor: '#1f2937',
            gap: 0,
            transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
          }}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">ORKA PPM</h2>
            <button
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center hover-optimized focus-optimized"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <ul className="space-y-2 flex-1 p-4">
            <li>
              <Link 
                href="/dashboards" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center hover-optimized focus-optimized"
                onClick={handleLinkClick}
              >
                Portfolio Dashboards
              </Link>
            </li>
            <li>
              <Link 
                href="/scenarios" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                What-If Scenarios
              </Link>
            </li>
            <li>
              <Link 
                href="/resources" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                Resource Management
              </Link>
            </li>
            <li>
              <Link 
                href="/reports" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                AI Reports & Analytics
              </Link>
            </li>
            <li>
              <Link 
                href="/financials" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                Financial Tracking
              </Link>
            </li>
            <li>
              <Link 
                href="/risks" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                Risk/Issue Registers
              </Link>
            </li>
            <li>
              <Link 
                href="/monte-carlo" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Monte Carlo Analysis
              </Link>
            </li>
            <li>
              <Link 
                href="/changes" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                Change Management
              </Link>
            </li>
            <li>
              <Link 
                href="/feedback" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Feedback & Ideas
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/performance" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
              >
                <Activity className="mr-2 h-4 w-4" />
                Performance Monitor
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/users" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
              >
                <Users className="mr-2 h-4 w-4" />
                User Management
              </Link>
            </li>
          </ul>
          
          <div className="p-4 border-t border-gray-700">
            <button 
              onClick={handleLogout} 
              className="flex items-center w-full py-3 px-4 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors min-h-[44px]"
            >
              <LogOut className="mr-2 h-4 w-4" /> 
              Logout
            </button>
          </div>
        </nav>
      </>
    )
  }

  // Desktop sidebar
  // CONDITIONAL: Get Chrome-specific classes only if browser is Chrome-based
  const chromeClasses = isChrome ? `${CHROME_SCROLL_CLASSES.SIDEBAR_SCROLL_OPTIMIZED} ${CHROME_SCROLL_CLASSES.SIDEBAR_BACKGROUND_CONSISTENCY} ${CHROME_SCROLL_CLASSES.SIDEBAR_SCROLL_STATE_BACKGROUND} ${CHROME_SCROLL_CLASSES.SIDEBAR_MOMENTUM_ARTIFACT_PREVENTION} ${CHROME_SCROLL_CLASSES.PERFORMANCE} ${CHROME_SCROLL_CLASSES.CONTAINER_PERFORMANCE} ${CHROME_SCROLL_CLASSES.DESKTOP_PERFORMANCE}` : ''
  
  // CONDITIONAL: Get Chrome-specific inline styles only if browser is Chrome-based
  const chromeStyles = isChrome ? {
    WebkitOverflowScrolling: 'touch' as const,
    overscrollBehavior: 'contain' as const,
    overscrollBehaviorY: 'contain' as const,
    willChange: 'scroll-position, transform',
    contain: 'layout style paint',
    backgroundAttachment: 'local' as const,
    backgroundImage: 'linear-gradient(to bottom, #1f2937 0%, #1f2937 100%)'
  } : {}
  
  // NEU: Non-Chrome browser styles for desktop (Firefox, Safari, etc.)
  const nonChromeStyles = !isChrome ? {
    scrollbarWidth: isFirefox ? ('thin' as const) : undefined,
    scrollbarColor: isFirefox ? 'rgba(155, 155, 155, 0.5) transparent' : undefined,
    WebkitOverflowScrolling: isSafari ? ('touch' as const) : undefined,
    // CRITICAL: Force display flex for all non-Chrome browsers
    display: 'flex' as const,
    flexDirection: 'column' as const
  } : {}
  
  return (
    <nav
      ref={sidebarRef}
      id="navigation"
      className={`hidden lg:flex w-64 h-screen p-4 bg-gray-800 text-white flex-col overflow-y-auto sidebar-optimized layout-stable ${getSidebarClasses(false)} ${getScrollPerformanceClasses()} ${chromeClasses} ${!isOpen ? 'hidden' : ''}`}
      style={{
        ...getSidebarStyles(),
        ...chromeStyles,
        ...nonChromeStyles,
        backgroundColor: '#1f2937',
        gap: 0
      }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">ORKA PPM</h1>
        <p className="text-gray-400 text-sm mt-1">Portfolio Management</p>
      </div>
      
      <ul className="space-y-2 flex-1">
        <li><Link href="/dashboards" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center hover-optimized focus-optimized">Portfolio Dashboards</Link></li>
        <li><Link href="/scenarios" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center">What-If Scenarios</Link></li>
        <li><Link href="/resources" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center">Resource Management</Link></li>
        <li><Link href="/reports" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center">AI Reports & Analytics</Link></li>
        <li><Link href="/financials" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center">Financial Tracking</Link></li>
        <li><Link href="/risks" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center">Risk/Issue Registers</Link></li>
        <li><Link href="/monte-carlo" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"><BarChart3 className="mr-2 h-4 w-4" />Monte Carlo Analysis</Link></li>
        <li><Link href="/changes" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center">Change Management</Link></li>
        <li><Link href="/feedback" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"><MessageSquare className="mr-2 h-4 w-4" />Feedback & Ideas</Link></li>
        <li><Link href="/admin/performance" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"><Activity className="mr-2 h-4 w-4" />Performance Monitor</Link></li>
        <li><Link href="/admin/users" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"><Users className="mr-2 h-4 w-4" />User Management</Link></li>
      </ul>
      
      <div className="mt-auto pt-4 border-t border-gray-700">
        <button 
          onClick={handleLogout} 
          className="flex items-center w-full py-2 px-4 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" /> 
          Logout
        </button>
      </div>
    </nav>
  )
}