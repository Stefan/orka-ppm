'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Activity, MessageSquare, X, Users, BarChart3, FileText, Layers, Shield } from 'lucide-react'
import { useAuth } from '../../app/providers/SupabaseAuthProvider'
import { GlobalLanguageSelector } from './GlobalLanguageSelector'
import { usePermissions } from '@/hooks/usePermissions'
import PermissionGuard from '../auth/PermissionGuard'

export interface SidebarProps {
  isOpen?: boolean
  onToggle?: () => void
  isMobile?: boolean
}

export default function Sidebar({ isOpen = true, onToggle, isMobile = false }: SidebarProps) {
  const router = useRouter()
  const { clearSession } = useAuth()
  const { hasPermission } = usePermissions()
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
                prefetch={true}
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                Portfolio Dashboards
              </Link>
            </li>
            <li>
              <Link 
                href="/projects" 
                prefetch={true}
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                Projects
              </Link>
            </li>
            <PermissionGuard permission="resource_read">
              <li>
                <Link 
                  href="/resources" 
                  prefetch={true}
                  className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                  onClick={handleLinkClick}
                >
                  Resource Management
                </Link>
              </li>
            </PermissionGuard>
            <PermissionGuard permission="financial_read">
              <li>
                <Link 
                  href="/financials" 
                  prefetch={true}
                  className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                  onClick={handleLinkClick}
                >
                  Financial Tracking
                </Link>
              </li>
            </PermissionGuard>
            <PermissionGuard permission="risk_read">
              <li>
                <Link 
                  href="/risks" 
                  prefetch={true}
                  className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                  onClick={handleLinkClick}
                >
                  Risk/Issue Registers
                </Link>
              </li>
            </PermissionGuard>
            <PermissionGuard permission={['report_read', 'analytics_read']}>
              <li>
                <Link 
                  href="/reports" 
                  prefetch={true}
                  className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                  onClick={handleLinkClick}
                >
                  AI Reports & Analytics
                </Link>
              </li>
            </PermissionGuard>
            <li>
              <Link 
                href="/scenarios" 
                prefetch={true}
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                What-If Scenarios
              </Link>
            </li>
            <PermissionGuard permission="analytics_read">
              <li>
                <Link 
                  href="/monte-carlo" 
                  prefetch={true}
                  className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                  onClick={handleLinkClick}
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Monte Carlo Analysis
                </Link>
              </li>
            </PermissionGuard>
            <PermissionGuard permission="change_read">
              <li>
                <Link 
                  href="/changes" 
                  prefetch={true}
                  className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                  onClick={handleLinkClick}
                >
                  Change Management
                </Link>
              </li>
            </PermissionGuard>
            <li>
              <Link 
                href="/project-controls" 
                prefetch={true}
                className="block py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px] flex items-center"
                onClick={handleLinkClick}
              >
                Project Controls
              </Link>
            </li>
            <PermissionGuard permission="audit_read">
              <li>
                <Link 
                  href="/audit" 
                  prefetch={true}
                  className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                  onClick={handleLinkClick}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Audit Trail
                </Link>
              </li>
            </PermissionGuard>
            <li>
              <Link 
                href="/feedback" 
                prefetch={true}
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Feedback & Ideas
              </Link>
            </li>
            <li>
              <Link 
                href="/features" 
                prefetch={true}
                className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                onClick={handleLinkClick}
              >
                <Layers className="mr-2 h-4 w-4" />
                Features
              </Link>
            </li>
            <PermissionGuard permission="admin_read">
              <li>
                <Link 
                  href="/admin" 
                  prefetch={true}
                  className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                  onClick={handleLinkClick}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </li>
              <li>
                <Link 
                  href="/admin/performance" 
                  prefetch={true}
                  className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                  onClick={handleLinkClick}
                >
                  <Activity className="mr-2 h-4 w-4" />
                  Performance Monitor
                </Link>
              </li>
            </PermissionGuard>
            <PermissionGuard permission="user_management">
              <li>
                <Link 
                  href="/admin/users" 
                  prefetch={true}
                  className="flex items-center py-3 px-4 rounded hover:bg-gray-700 transition-colors min-h-[44px]"
                  onClick={handleLinkClick}
                >
                  <Users className="mr-2 h-4 w-4" />
                  User Management
                </Link>
              </li>
            </PermissionGuard>
          </ul>
          
          <div className="p-4 border-t border-gray-700">
            <GlobalLanguageSelector />
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
            prefetch={true}
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
            href="/projects" 
            prefetch={true}
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Projects
          </Link>
        </li>
        {hasPermission('resource_read') && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/resources" 
              prefetch={true}
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
        )}
        {hasPermission('financial_read') && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/financials" 
              prefetch={true}
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
        )}
        {hasPermission('risk_read') && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/risks" 
              prefetch={true}
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
        )}
        {(hasPermission('report_read') || hasPermission('analytics_read')) && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/reports" 
              prefetch={true}
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
        )}
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/scenarios" 
            prefetch={true}
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
        {hasPermission('analytics_read') && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/monte-carlo" 
              prefetch={true}
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
        )}
        {hasPermission('change_read') && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/changes" 
              prefetch={true}
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
        )}
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/project-controls" 
            prefetch={true}
            style={{ 
              display: 'block', 
              padding: '0.5rem 1rem', 
              borderRadius: '0.375rem', 
              color: '#ffffff', 
              textDecoration: 'none',
              transition: 'background-color 0.2s'
            }}
          >
            Project Controls
          </Link>
        </li>
        {hasPermission('audit_read') && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/audit" 
              prefetch={true}
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
              <FileText className="mr-2 h-4 w-4" />
              Audit Trail
            </Link>
          </li>
        )}
        <li style={{ display: 'block', width: '100%' }}>
          <Link 
            href="/feedback" 
            prefetch={true}
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
        {hasPermission('admin_read') && (
          <>
            <li style={{ display: 'block', width: '100%' }}>
              <Link 
                href="/admin" 
                prefetch={true}
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
                <Shield className="mr-2 h-4 w-4" />
                Admin
              </Link>
            </li>
            <li style={{ display: 'block', width: '100%' }}>
              <Link 
                href="/admin/performance" 
                prefetch={true}
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
          </>
        )}
        {hasPermission('user_management') && (
          <li style={{ display: 'block', width: '100%' }}>
            <Link 
              href="/admin/users" 
              prefetch={true}
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
        )}
      </ul>
      
      <div style={{ padding: '1rem', marginTop: '1rem', borderTop: '1px solid #374151', flexShrink: 0 }}>
        <GlobalLanguageSelector />
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
