'use client'


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

  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out...')
      await clearSession()
      console.log('✅ Logout successful')
      // Redirect to home page (login screen)
      router.push('/')
      // Force page refresh to ensure clean state
      window.location.href = '/'
    } catch (err) {
      console.error('🚨 Logout exception:', err)
      // Fallback: still redirect even if logout fails
      router.push('/')
    }
  }

  const handleLinkClick = () => {
    // Close mobile sidebar when link is clicked
    if (isMobile && onToggle) {
      onToggle()
    }
  }

  // Mobile overlay
  if (isMobile && isOpen) {
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
        
        {/* Mobile Sidebar */}
        <nav 
          id="navigation"
          className="fixed left-0 top-0 h-full w-64 bg-gray-800 text-white flex flex-col z-50 lg:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto sidebar-optimized animation-optimized modal-optimized"
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700 layout-stable">
            <h2 className="text-xl font-bold text-white text-optimized">PPM Dashboard</h2>
            <button
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center hover-optimized focus-optimized"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <ul className="space-y-2 flex-1 p-4" role="list">
            <li role="listitem">
              <Link 
                href="/dashboards" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center hover-optimized focus-optimized"
                onClick={handleLinkClick}
                aria-label="Go to Portfolio Dashboards"
              >
                Portfolio Dashboards
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/scenarios" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
                aria-label="Go to What-If Scenarios"
              >
                What-If Scenarios
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/resources" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
                aria-label="Go to Resource Management"
              >
                Resource Management
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/reports" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
                aria-label="Go to AI Reports & Analytics"
              >
                AI Reports & Analytics
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/financials" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
                aria-label="Go to Financial Tracking"
              >
                Financial Tracking
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/risks" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
                aria-label="Go to Risk/Issue Registers"
              >
                Risk/Issue Registers
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/monte-carlo" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
                aria-label="Go to Monte Carlo Analysis"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Monte Carlo Analysis
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/changes" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
                aria-label="Go to Change Management"
              >
                Change Management
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/feedback" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
                aria-label="Go to Feedback & Ideas"
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Feedback & Ideas
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/admin/performance" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
                aria-label="Go to Performance Monitor"
              >
                <Activity className="mr-2 h-4 w-4" />
                Performance Monitor
              </Link>
            </li>
            <li role="listitem">
              <Link 
                href="/admin/users" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
                aria-label="Go to User Management"
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
              aria-label="Logout from application"
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
  return (
    <nav 
      id="navigation"
      className={`hidden lg:flex w-64 h-screen p-4 bg-gray-800 text-white flex-col overflow-y-auto sidebar-optimized layout-stable ${!isOpen ? 'hidden' : ''}`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="mb-8 layout-stable">
        <h2 className="text-xl font-bold text-white text-optimized">PPM Dashboard</h2>
      </div>
      
      <ul className="space-y-2 flex-1" role="list">
        <li role="listitem"><Link href="/dashboards" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center hover-optimized focus-optimized" aria-label="Go to Portfolio Dashboards">Portfolio Dashboards</Link></li>
        <li role="listitem"><Link href="/scenarios" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center" aria-label="Go to What-If Scenarios">What-If Scenarios</Link></li>
        <li role="listitem"><Link href="/resources" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center" aria-label="Go to Resource Management">Resource Management</Link></li>
        <li role="listitem"><Link href="/reports" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center" aria-label="Go to AI Reports & Analytics">AI Reports & Analytics</Link></li>
        <li role="listitem"><Link href="/financials" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center" aria-label="Go to Financial Tracking">Financial Tracking</Link></li>
        <li role="listitem"><Link href="/risks" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center" aria-label="Go to Risk/Issue Registers">Risk/Issue Registers</Link></li>
        <li role="listitem">
          <Link href="/monte-carlo" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]" aria-label="Go to Monte Carlo Analysis">
            <BarChart3 className="mr-2 h-4 w-4" />
            Monte Carlo Analysis
          </Link>
        </li>
        <li role="listitem"><Link href="/changes" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center" aria-label="Go to Change Management">Change Management</Link></li>
        <li role="listitem">
          <Link href="/feedback" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]" aria-label="Go to Feedback & Ideas">
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback & Ideas
          </Link>
        </li>
        <li role="listitem">
          <Link href="/admin/performance" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]" aria-label="Go to Performance Monitor">
            <Activity className="mr-2 h-4 w-4" />
            Performance Monitor
          </Link>
        </li>
        <li role="listitem">
          <Link href="/admin/users" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]" aria-label="Go to User Management">
            <Users className="mr-2 h-4 w-4" />
            User Management
          </Link>
        </li>
      </ul>
      
      <div className="mt-auto pt-4 border-t border-gray-700">
        <button 
          onClick={handleLogout} 
          className="flex items-center w-full py-2 px-4 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors min-h-[44px]"
          aria-label="Logout from application"
        >
          <LogOut className="mr-2 h-4 w-4" /> 
          Logout
        </button>
      </div>
    </nav>
  )
}