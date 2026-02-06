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
  Layers,
  Shield,
  Settings,
  Target,
  Calendar,
  BookOpen,
  Upload
} from 'lucide-react'

export interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  // Overview
  { href: '/dashboards', label: 'Portfolio Dashboards', icon: LayoutDashboard, group: 'Overview' },

  // Projects & Resources
  { href: '/projects', label: 'All Projects', icon: GitBranch, group: 'Projects' },
  { href: '/resources', label: 'Resource Management', icon: Users, group: 'Projects' },
  { href: '/projects/import', label: 'Import', icon: Upload, group: 'Projects' },

  // Financial Management
  { href: '/financials', label: 'Budget & Cost Tracking', icon: DollarSign, group: 'Financials' },
  { href: '/reports', label: 'Reports & Analytics', icon: FileText, group: 'Financials' },
  { href: '/project-controls', label: 'Project Controls (ETC/EAC)', icon: Target, group: 'Financials' },
  { href: '/reports/pmr', label: 'Project Monthly Report', shortLabel: 'PMR', icon: BookOpen, group: 'Financials' },

  // Risk & Analysis
  { href: '/risks', label: 'Risk Management', icon: AlertTriangle, group: 'Analysis' },
  { href: '/scenarios', label: 'What-If Scenarios', icon: GitBranch, group: 'Analysis' },
  { href: '/monte-carlo', label: 'Monte Carlo Analysis', icon: BarChart3, group: 'Analysis' },
  { href: '/audit', label: 'Audit Trail', icon: FileText, group: 'Analysis' },
  { href: '/schedules', label: 'Schedule Management', icon: Calendar, group: 'Analysis' },

  // Change & Feedback
  { href: '/changes', label: 'Change Management', icon: GitPullRequest, group: 'Management' },
  { href: '/feedback', label: 'Feedback & Ideas', icon: MessageSquare, group: 'Management' },
  { href: '/features', label: 'Features Overview', icon: Layers, group: 'Management' },
  { href: '/settings', label: 'Settings', icon: Settings, group: 'Management' },

  // Administration
  { href: '/admin', label: 'System Admin', icon: Shield, group: 'Admin' },
  { href: '/admin/performance', label: 'Performance Monitor', icon: Activity, group: 'Admin' },
  { href: '/admin/users', label: 'User Management', icon: UserCog, group: 'Admin' },
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
        className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-slate-900 z-50 xl:hidden transform transition-transform duration-300 ease-in-out overflow-y-auto"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        {/* Header */}
        <div data-testid="mobile-nav-header" className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">O</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">ORKA PPM</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Portfolio Management</p>
            </div>
          </div>
          <button
            data-testid="mobile-nav-close"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav data-testid="mobile-nav-links" className="p-3">
          {(() => {
            // Group items by their group property
            const groups = NAV_ITEMS.reduce((acc, item) => {
              const group = item.group || 'Other'
              if (!acc[group]) acc[group] = []
              acc[group].push(item)
              return acc
            }, {} as Record<string, typeof NAV_ITEMS>)

            return Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName} className="mb-6">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider px-3 mb-2">
                  {groupName}
                </h3>
                <ul className="space-y-1">
                  {items.map((item) => {
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
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                              : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700/80'
                            }
                          `}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" />
                          <span className="text-sm">
                            {'shortLabel' in item && item.shortLabel ? (
                              <>
                                <span className="hidden sm:inline">{item.label}</span>
                                <span className="sm:hidden">{item.shortLabel}</span>
                              </>
                            ) : (
                              item.label
                            )}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          })()}
        </nav>
      </div>
    </>
  )
}
