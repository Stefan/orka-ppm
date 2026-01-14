'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Activity, MessageSquare, X, Users, BarChart3 } from 'lucide-react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'

export interface SidebarProps {
  isOpen?: boolean
  onToggle?: () => void
  isMobile?: boolean
}

export default function Sidebar({ isOpen = true, onToggle, isMobile = false }: SidebarProps) {
  const router = useRouter()
  const { clearSession } = useAuth()
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const sidebarElement = sidebarRef.current
    if (!sidebarElement) return

    // Simple scroll optimization without browser detection
    const handleScroll = () => {
      // Optional: Add scroll performance monitoring
    }

    sidebarElement.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      sidebarElement.removeEventListener('scroll', handleScroll)
    }
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

  const handleLinkClick = () => {
    if (isMobile && onToggle) {
      onToggle()
    }
  }

  // Mobile overlay
  if (isMobile && isOpen) {
    return (
      <>
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
        
        <nav 
          ref={sidebarRef}
          id="navigation"
          className="fixed left-0 top-0 h-full w-64 bg-gray-800 text-white flex flex-col z-50 lg:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto"
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
          }}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold">ORKA PPM</h2>
            <button
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <ul className="space-y-2 flex-1 p-4">
            <li>
              <Link 
                href="/dashboards" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
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

  // Desktop sidebar - Standard CSS that works in all browsers
  return (
    <nav
      ref={sidebarRef}
      id="navigation"
      className="hidden lg:flex lg:flex-col w-64 h-screen p-4 bg-gray-800 text-white overflow-y-auto"
    >
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">ORKA PPM</h1>
        <p className="text-gray-400 text-sm mt-1">Portfolio Management</p>
      </div>
      
      <ul className="space-y-2 flex-1">
        <li>
          <Link 
            href="/dashboards" 
            className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
          >
            Portfolio Dashboards
          </Link>
        </li>
        <li>
          <Link 
            href="/scenarios" 
            className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
          >
            What-If Scenarios
          </Link>
        </li>
        <li>
          <Link 
            href="/resources" 
            className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
          >
            Resource Management
          </Link>
        </li>
        <li>
          <Link 
            href="/reports" 
            className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
          >
            AI Reports & Analytics
          </Link>
        </li>
        <li>
          <Link 
            href="/financials" 
            className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
          >
            Financial Tracking
          </Link>
        </li>
        <li>
          <Link 
            href="/risks" 
            className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
          >
            Risk/Issue Registers
          </Link>
        </li>
        <li>
          <Link 
            href="/monte-carlo" 
            className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Monte Carlo Analysis
          </Link>
        </li>
        <li>
          <Link 
            href="/changes" 
            className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
          >
            Change Management
          </Link>
        </li>
        <li>
          <Link 
            href="/feedback" 
            className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback & Ideas
          </Link>
        </li>
        <li>
          <Link 
            href="/admin/performance" 
            className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            <Activity className="mr-2 h-4 w-4" />
            Performance Monitor
          </Link>
        </li>
        <li>
          <Link 
            href="/admin/users" 
            className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
          >
            <Users className="mr-2 h-4 w-4" />
            User Management
          </Link>
        </li>
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