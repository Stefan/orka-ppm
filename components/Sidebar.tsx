'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Activity, MessageSquare, Menu, X, Users } from 'lucide-react'
import { useAuth } from '../app/providers/SupabaseAuthProvider'

interface SidebarProps {
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
        <nav className="fixed left-0 top-0 h-full w-64 bg-gray-800 text-white flex flex-col z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">PPM Dashboard</h2>
            <button
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <ul className="space-y-2 flex-1 p-4">
            <li>
              <Link 
                href="/dashboards" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                Portfolio Dashboards
              </Link>
            </li>
            <li>
              <Link 
                href="/scenarios" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                What-If Scenarios
              </Link>
            </li>
            <li>
              <Link 
                href="/resources" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                Resource Management
              </Link>
            </li>
            <li>
              <Link 
                href="/reports" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                AI Reports & Analytics
              </Link>
            </li>
            <li>
              <Link 
                href="/financials" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                Financial Tracking
              </Link>
            </li>
            <li>
              <Link 
                href="/risks" 
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                Risk/Issue Registers
              </Link>
            </li>
            <li>
              <Link 
                href="/feedback" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Feedback & Ideas
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/performance" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors"
                onClick={handleLinkClick}
              >
                <Activity className="mr-2 h-4 w-4" />
                Performance Monitor
              </Link>
            </li>
            <li>
              <Link 
                href="/admin/users" 
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors"
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
              className="flex items-center w-full py-3 px-4 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
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
    <nav className={`hidden lg:flex w-64 h-screen p-4 bg-gray-800 text-white flex-col ${!isOpen ? 'hidden' : ''}`}>
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white">PPM Dashboard</h2>
      </div>
      
      <ul className="space-y-2 flex-1">
        <li><Link href="/dashboards" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors">Portfolio Dashboards</Link></li>
        <li><Link href="/scenarios" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors">What-If Scenarios</Link></li>
        <li><Link href="/resources" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors">Resource Management</Link></li>
        <li><Link href="/reports" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors">AI Reports & Analytics</Link></li>
        <li><Link href="/financials" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors">Financial Tracking</Link></li>
        <li><Link href="/risks" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors">Risk/Issue Registers</Link></li>
        <li>
          <Link href="/feedback" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors">
            <MessageSquare className="mr-2 h-4 w-4" />
            Feedback & Ideas
          </Link>
        </li>
        <li>
          <Link href="/admin/performance" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors">
            <Activity className="mr-2 h-4 w-4" />
            Performance Monitor
          </Link>
        </li>
        <li>
          <Link href="/admin/users" className="flex items-center py-2 px-4 rounded hover:bg-gray-700 transition-colors">
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