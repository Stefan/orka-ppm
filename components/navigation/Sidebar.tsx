'use client'

import { useRef } from 'react'
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

  // Desktop sidebar - Explicit styles for cross-browser consistency
  return (
    <nav
      ref={sidebarRef}
      id="navigation"
      className="hidden lg:block w-64 h-screen bg-gray-800 text-white flex-shrink-0"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: '256px',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: '#1f2937',
        color: '#ffffff',
        display: 'none'
      }}
    >
      <style jsx>{`
        @media (min-width: 1024px) {
          nav#navigation {
            display: flex !important;
            flex-direction: column !important;
          }
        }
      `}</style>
      
      <div style={{ padding: '1rem', marginBottom: '1rem', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff', margin: 0, display: 'block' }}>
          ORKA PPM
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem', display: 'block' }}>
          Portfolio Management
        </p>
      </div>
      
      <ul style={{ padding: '0 1rem', margin: 0, listStyle: 'none', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/dashboards" 
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Portfolio Dashboards
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/scenarios" 
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            What-If Scenarios
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/resources" 
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Resource Management
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/reports" 
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            AI Reports & Analytics
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/financials" 
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Financial Tracking
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/risks" 
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Risk/Issue Registers
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/monte-carlo" 
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Monte Carlo Analysis
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/changes" 
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Change Management
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/feedback" 
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback & Ideas
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/admin/performance" 
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            <Activity className="mr-2 h-4 w-4" />
            Performance Monitor
          </Link>
        </li>
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/admin/users" 
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            User Management
          </Link>
        </li>
      </ul>
      
      <div style={{ padding: '1rem', marginTop: '1rem', borderTop: '1px solid #374151', flexShrink: 0 }}>
        <button 
          onClick={handleLogout} 
          style={{ 
            display: 'flex', 
            alignItems: 'center',
            width: '100%',
            padding: '0.5rem 1rem', 
            borderRadius: '0.375rem', 
            color: '#d1d5db', 
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s, color 0.2s'
          }}
        >
          <LogOut className="mr-2 h-4 w-4" /> 
          Logout
        </button>
      </div>
    </nav>
  )
}
