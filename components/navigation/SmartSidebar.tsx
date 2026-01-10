'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { 
  LogOut, 
  Activity, 
  MessageSquare, 
  X, 
  Users, 
  BarChart3,
  Home,
  Layers,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Settings,
  Zap,
  Clock,
  Star
} from 'lucide-react'
import { useAuth } from '../app/providers/SupabaseAuthProvider'
import { useNavigationAnalytics } from '../hooks/useNavigationAnalytics'
import { useMediaQuery } from '../hooks/useMediaQuery'
import type { NavigationItem, AINavigationSuggestion } from '../types/navigation'

interface SmartSidebarProps {
  isOpen?: boolean
  onToggle?: () => void
  isMobile?: boolean
}

// Navigation items configuration
const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'dashboards',
    label: 'Portfolio Dashboards',
    icon: Home,
    href: '/dashboards',
    category: 'primary',
    description: 'Overview of all your projects and portfolios'
  },
  {
    id: 'scenarios',
    label: 'What-If Scenarios',
    icon: Layers,
    href: '/scenarios',
    category: 'primary',
    description: 'Explore different project scenarios and outcomes'
  },
  {
    id: 'resources',
    label: 'Resource Management',
    icon: Users,
    href: '/resources',
    category: 'primary',
    description: 'Manage team resources and allocations'
  },
  {
    id: 'reports',
    label: 'AI Reports & Analytics',
    icon: TrendingUp,
    href: '/reports',
    category: 'primary',
    description: 'AI-powered insights and analytics'
  },
  {
    id: 'financials',
    label: 'Financial Tracking',
    icon: DollarSign,
    href: '/financials',
    category: 'primary',
    description: 'Track budgets, costs, and financial performance'
  },
  {
    id: 'risks',
    label: 'Risk/Issue Registers',
    icon: AlertTriangle,
    href: '/risks',
    category: 'secondary',
    description: 'Manage project risks and issues'
  },
  {
    id: 'monte-carlo',
    label: 'Monte Carlo Analysis',
    icon: BarChart3,
    href: '/monte-carlo',
    category: 'secondary',
    description: 'Advanced statistical analysis and simulations'
  },
  {
    id: 'changes',
    label: 'Change Management',
    icon: Settings,
    href: '/changes',
    category: 'secondary',
    description: 'Track and manage project changes'
  },
  {
    id: 'feedback',
    label: 'Feedback & Ideas',
    icon: MessageSquare,
    href: '/feedback',
    category: 'secondary',
    description: 'Submit feedback and improvement ideas'
  },
  {
    id: 'performance',
    label: 'Performance Monitor',
    icon: Activity,
    href: '/admin/performance',
    category: 'admin',
    description: 'Monitor system performance and metrics'
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: Users,
    href: '/admin/users',
    category: 'admin',
    description: 'Manage users and permissions'
  }
]

export default function SmartSidebar({ 
  isOpen = true, 
  onToggle, 
  isMobile = false 
}: SmartSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, clearSession } = useAuth()
  const { 
    trackNavigation, 
    getUsageFrequency, 
    getContextualSuggestions 
  } = useNavigationAnalytics()
  
  const [aiSuggestions, setAiSuggestions] = useState<AINavigationSuggestion[]>([])
  const [navigationStartTime, setNavigationStartTime] = useState<number>(Date.now())
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')

  // Update AI suggestions based on current context
  useEffect(() => {
    const suggestions = getContextualSuggestions(NAVIGATION_ITEMS)
    setAiSuggestions(suggestions)
  }, [getContextualSuggestions])

  // Track time spent on current page
  useEffect(() => {
    const currentItem = NAVIGATION_ITEMS.find(item => pathname.startsWith(item.href))
    if (currentItem) {
      const timeSpent = Date.now() - navigationStartTime
      if (timeSpent > 5000) { // Only track if spent more than 5 seconds
        trackNavigation(currentItem.id, timeSpent)
      }
    }
    setNavigationStartTime(Date.now())
  }, [pathname, trackNavigation, navigationStartTime])

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

  const handleLinkClick = useCallback((itemId: string) => {
    // Track navigation
    trackNavigation(itemId)
    
    // Close mobile sidebar when link is clicked
    if (isMobile && onToggle) {
      onToggle()
    }
  }, [trackNavigation, isMobile, onToggle])

  const renderNavigationItem = (item: NavigationItem) => {
    const isActive = pathname.startsWith(item.href)
    const usageFrequency = getUsageFrequency(item.id)
    const isAISuggested = aiSuggestions.some(s => s.itemId === item.id)
    const suggestion = aiSuggestions.find(s => s.itemId === item.id)

    return (
      <li key={item.id}>
        <Link
          href={item.href}
          className={`
            group flex items-center py-3 px-4 rounded-lg transition-all duration-200
            hover:bg-gray-700 relative
            ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}
            ${isAISuggested ? 'ring-1 ring-blue-400 ring-opacity-50' : ''}
            min-h-[44px] touch-manipulation
          `}
          onClick={() => handleLinkClick(item.id)}
          aria-label={`${item.label}${item.description ? ` - ${item.description}` : ''}`}
        >
          <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="truncate block">{item.label}</span>
            {suggestion && suggestion.message && (
              <span className="text-xs text-blue-200 truncate block">
                {suggestion.message}
              </span>
            )}
          </div>
          
          {/* Usage frequency indicator */}
          {usageFrequency > 0 && (
            <div className="flex items-center ml-2">
              {usageFrequency >= 10 && (
                <Star className="h-3 w-3 text-yellow-400" />
              )}
              {usageFrequency >= 5 && usageFrequency < 10 && (
                <Clock className="h-3 w-3 text-blue-400" />
              )}
            </div>
          )}
          
          {/* AI suggestion indicator */}
          {isAISuggested && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
          )}
          
          {/* Badge for notifications */}
          {item.badge && (
            <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
              {item.badge}
            </span>
          )}
        </Link>
      </li>
    )
  }

  const renderAISuggestions = () => {
    if (aiSuggestions.length === 0) return null

    return (
      <div className="p-4 bg-gradient-to-r from-blue-900 to-blue-800 bg-opacity-50 border-b border-gray-700">
        <div className="flex items-center mb-2">
          <Zap className="h-4 w-4 text-blue-300 mr-2" />
          <h3 className="text-sm font-medium text-blue-200">
            AI Suggestions
          </h3>
        </div>
        <div className="space-y-1">
          {aiSuggestions.slice(0, 2).map((suggestion, index) => {
            const item = NAVIGATION_ITEMS.find(item => item.id === suggestion.itemId)
            if (!item) return null
            
            return (
              <div key={index} className="text-xs text-blue-100 flex items-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 flex-shrink-0" />
                <span className="truncate">{suggestion.message}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Mobile sidebar
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onToggle}
          />
        )}
        
        {/* Mobile Sidebar */}
        <nav className={`
          fixed left-0 top-0 h-full w-64 bg-gray-900 text-white 
          flex flex-col z-50 lg:hidden
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">PPM Dashboard</h2>
            <button
              onClick={onToggle}
              className="p-2 rounded-md hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* AI Suggestions */}
          {renderAISuggestions()}
          
          {/* Navigation Items */}
          <ul className="space-y-1 flex-1 p-4 overflow-y-auto">
            {NAVIGATION_ITEMS.map(renderNavigationItem)}
          </ul>
          
          {/* Footer */}
          <div className="p-4 border-t border-gray-700">
            <button 
              onClick={handleLogout} 
              className="flex items-center w-full py-3 px-4 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors min-h-[44px]"
              aria-label="Logout from application"
            >
              <LogOut className="mr-3 h-4 w-4" /> 
              Logout
            </button>
          </div>
        </nav>
      </>
    )
  }

  // Desktop sidebar
  return (
    <nav className={`
      hidden lg:flex w-64 h-screen bg-gray-900 text-white flex-col
      ${!isOpen ? 'hidden' : ''}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white">PPM Dashboard</h2>
      </div>
      
      {/* AI Suggestions */}
      {renderAISuggestions()}
      
      {/* Navigation Items */}
      <ul className="space-y-1 flex-1 p-4 overflow-y-auto">
        {NAVIGATION_ITEMS.map(renderNavigationItem)}
      </ul>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <button 
          onClick={handleLogout} 
          className="flex items-center w-full py-2 px-4 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          aria-label="Logout from application"
        >
          <LogOut className="mr-2 h-4 w-4" /> 
          Logout
        </button>
      </div>
    </nav>
  )
}