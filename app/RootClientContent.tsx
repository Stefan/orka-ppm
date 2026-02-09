'use client'

import React from 'react'
import { QueryProvider } from './providers/QueryProvider'
import { SupabaseAuthProvider } from './providers/SupabaseAuthProvider'
import { FeatureFlagProvider } from '@/contexts/FeatureFlagContext'
import { EnhancedAuthProvider } from './providers/EnhancedAuthProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { ErrorBoundary } from '../components/shared/ErrorBoundary'
import { ToastProvider } from '../components/shared/Toast'
import PerformanceOptimizer from '../components/performance/PerformanceOptimizer'
import { ResourcePreloader } from '../components/performance/ResourcePreloader'
import PredictivePrefetcher from '../components/performance/PredictivePrefetcher'
import FirefoxSidebarFix from '../components/navigation/FirefoxSidebarFix'
import { I18nProvider } from '@/lib/i18n/context'
import { PortfolioProvider } from '@/contexts/PortfolioContext'
import { RtlDirection } from '../components/navigation/RtlDirection'

/**
 * Single client boundary for all app providers + page children.
 * Ensures usePortfolio() and other context hooks see their providers
 * regardless of Next.js server/client segment boundaries.
 */
export default function RootClientContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FirefoxSidebarFix />
      <ResourcePreloader />
      <PredictivePrefetcher enabled={true} />
    <PerformanceOptimizer>
      <ErrorBoundary>
        <QueryProvider>
          <SupabaseAuthProvider>
            <ThemeProvider>
              <EnhancedAuthProvider>
                <FeatureFlagProvider>
                  <I18nProvider>
                    <PortfolioProvider>
                      <RtlDirection />
                      <ToastProvider>
                        {children}
                      </ToastProvider>
                    </PortfolioProvider>
                  </I18nProvider>
                </FeatureFlagProvider>
              </EnhancedAuthProvider>
            </ThemeProvider>
          </SupabaseAuthProvider>
        </QueryProvider>
      </ErrorBoundary>
    </PerformanceOptimizer>
    </>
  )
}
