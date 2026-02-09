'use client'

/**
 * Phase 1: Page Context Provider
 * Provides current page context (route, role, data) to AI Help Chat
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '../app/providers/SupabaseAuthProvider'

export interface PageContextData {
  route: string
  pageTitle: string
  userRole: string
  organizationId?: string
  currentProject?: string
  currentPortfolio?: string
  relevantData?: Record<string, any>
}

interface PageContextProviderProps {
  children: React.ReactNode
}

interface PageContextType {
  context: PageContextData
  updateContext: (updates: Partial<PageContextData>) => void
  setRelevantData: (data: Record<string, any>) => void
}

const PageContext = createContext<PageContextType | undefined>(undefined)

export function PageContextProvider({ children }: PageContextProviderProps) {
  const pathname = usePathname()
  const { user, organizationContext } = useAuth()
  
  const [context, setContext] = useState<PageContextData>({
    route: pathname || '/',
    pageTitle: 'Dashboard',
    userRole: (user as { role?: string } | null)?.role || 'viewer',
    organizationId: organizationContext?.organizationId ?? undefined,
    relevantData: {}
  })

  // Update route and page title when pathname changes
  useEffect(() => {
    const pageTitleMap: Record<string, string> = {
      '/': 'Dashboard',
      '/dashboards': 'Dashboards',
      '/projects': 'Projects',
      '/financials': 'Financials',
      '/financials/costbook': 'Costbook',
      '/resources': 'Resources',
      '/risks': 'Risks',
      '/reports': 'Reports',
      '/admin': 'Admin',
      '/audit': 'Audit Trail',
      '/import': 'Data Import'
    }

    const pageTitle = pageTitleMap[pathname] || 'Page'
    
    setContext(prev => ({
      ...prev,
      route: pathname,
      pageTitle,
      userRole: (user as { role?: string } | null)?.role || prev.userRole,
      organizationId: organizationContext?.organizationId ?? prev.organizationId
    }))
  }, [pathname, user, organizationContext])

  const updateContext = useCallback((updates: Partial<PageContextData>) => {
    setContext(prev => ({ ...prev, ...updates }))
  }, [])

  const setRelevantData = useCallback((data: Record<string, any>) => {
    setContext(prev => ({
      ...prev,
      relevantData: { ...prev.relevantData, ...data }
    }))
  }, [])

  return (
    <PageContext.Provider value={{ context, updateContext, setRelevantData }}>
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext() {
  const context = useContext(PageContext)
  if (!context) {
    throw new Error('usePageContext must be used within PageContextProvider')
  }
  return context
}
