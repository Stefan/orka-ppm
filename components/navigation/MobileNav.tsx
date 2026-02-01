'use client'

import { useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  X, 
  LayoutDashboard,
  GitBranch,
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  BarChart3,
  GitPullRequest,
  MessageSquare,
  Activity,
  UserCog,
  Layers
} from 'lucide-react'

export interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  { href: '/dashboards', label: 'Portfolio Dashboards', icon: LayoutDashboard },
  { href: '/scenarios', label: 'What-If Scenarios', icon: GitBranch },
  { href: '/resources', label: 'Resource Management', icon: Users },
  { href: '/reports', label: 'AI Reports & Analytics', icon: FileText },
  { href: '/financials', label: 'Financial Tracking', icon: DollarSign },
  { href: '/risks', label: 'Risk/Issue Registers', icon: AlertTriangle },
  { href: '/monte-carlo', label: 'Monte Carlo Analysis', icon: BarChart3 },
  { href: '/changes', label: 'Change Management', icon: GitPullRequest },
  { href: '/feedback', label: 'Feedback & Ideas', icon: MessageSquare },
  { href: '/features', label: 'Features Overview', icon: Layers },
  { href: '/admin/performance', label: 'Performance Monitor', icon: Activity },
  { href: '/admin/users', label: 'User Management', icon: UserCog },
]

export default function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname()
  const navRef = useRef<HTMLDivElement>(null)

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 xl:hidden"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        data-testid="mobile-nav"
        ref={navRef}
        className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white z-50 xl:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        {/* Header */}
        <div data-testid="mobile-nav-header" className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">ORKA PPM</h2>
              <p className="text-xs text-gray-500">Portfolio Management</p>
            </div>
          </div>
          <button
            data-testid="mobile-nav-close"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav data-testid="mobile-nav-links" className="p-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={`
                      flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all
                      ${isActive 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </>
  )
}
