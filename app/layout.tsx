import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { QueryProvider } from './providers/QueryProvider'
import { SupabaseAuthProvider } from './providers/SupabaseAuthProvider'
import { FeatureFlagProvider } from '@/contexts/FeatureFlagContext'
import { EnhancedAuthProvider } from './providers/EnhancedAuthProvider'
import { ThemeProvider, ThemeScript } from './providers/ThemeProvider'
import { ErrorBoundary } from '../components/shared/ErrorBoundary'
import { ToastProvider } from '../components/shared/Toast'
import PerformanceOptimizer from '../components/performance/PerformanceOptimizer'
import { ResourcePreloader } from '../components/performance/ResourcePreloader'
import PredictivePrefetcher from '../components/performance/PredictivePrefetcher'
import FirefoxSidebarFix from '../components/navigation/FirefoxSidebarFix'
import { I18nProvider } from '@/lib/i18n/context'

// Import critical CSS directly - Next.js will optimize and inline it automatically
import './critical.css'

// Import globals.css - Next.js will handle optimization
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap', // Optimizes font loading to prevent layout shifts
  // Font preloading disabled to prevent unused preload warnings
  preload: false,
})

export const metadata: Metadata = {
  title: 'Orka PPM',
  description: 'AI-gestütztes Projekt und Portfolio Management',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Orka PPM',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Orka PPM',
    title: 'Orka PPM - AI Project Portfolio Management',
    description: 'AI-gestütztes Projekt und Portfolio Management',
  },
  icons: {
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
    other: [
      { rel: 'icon', type: 'image/svg+xml', sizes: '32x32', url: '/favicon-32x32.svg' },
      { rel: 'icon', type: 'image/svg+xml', sizes: '16x16', url: '/favicon-16x16.svg' },
    ],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} chrome-optimized`} suppressHydrationWarning>
      <head>
        {/* Theme script to prevent flash of incorrect theme */}
        <ThemeScript />
        
        {/* In development: unregister stale service workers that cache old JS/CSS bundles */}
        {process.env.NODE_ENV === 'development' && (
          <script dangerouslySetInnerHTML={{ __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                registrations.forEach(function(registration) {
                  registration.unregister().then(function() {
                    console.log('[DEV] Unregistered stale service worker');
                  });
                });
                if (registrations.length > 0) {
                  caches.keys().then(function(names) {
                    names.forEach(function(name) { caches.delete(name); });
                    console.log('[DEV] Cleared service worker caches:', names);
                  });
                }
              });
            }
          `}} suppressHydrationWarning />
        )}
        
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Orka PPM" />
        <meta name="application-name" content="Orka PPM" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://orka-ppm.onrender.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://orka-ppm.onrender.com" />
        
        {/* Preload critical API endpoints for faster data fetching */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL || 'https://orka-ppm.onrender.com'} crossOrigin="anonymous" />
        
        {/* Next.js automatically handles JavaScript chunk preloading - no manual preload needed */}
        {/* Preload critical fonts - Inter is loaded via next/font/google with automatic optimization */}
        {/* Next.js automatically inlines and optimizes Google Fonts, no manual preload needed */}
        
        {/* Icons with proper dimensions - removed preload as they're not critical for LCP */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="icon" type="image/svg+xml" sizes="32x32" href="/favicon-32x32.svg" />
        <link rel="icon" type="image/svg+xml" sizes="16x16" href="/favicon-16x16.svg" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#2563eb" />
        
        {/* 
          Critical CSS is automatically inlined by Next.js when imported at the top of this file.
          Next.js optimizes CSS imports and inlines critical styles automatically.
          No manual inlining needed - Next.js handles this during build.
        */}
      </head>
      <body 
        className="font-sans antialiased min-h-screen chrome-optimized chrome-background-coverage" 
        suppressHydrationWarning={true}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          backgroundAttachment: 'local'
        } as React.CSSProperties}
      >
        {/* Visible fallback before React hydrates or if JS fails - prevents white page */}
        <noscript>
          <div style={{ padding: 24, textAlign: 'center', color: '#374151', fontFamily: 'system-ui, sans-serif' }}>
            Orka PPM – Please enable JavaScript to use this app.
          </div>
        </noscript>
        {/* Root loading removed - was causing dark mode issues */}
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
                      <ToastProvider>
                        {children}
                      </ToastProvider>
                    </I18nProvider>
                  </FeatureFlagProvider>
                </EnhancedAuthProvider>
              </ThemeProvider>
            </SupabaseAuthProvider>
            </QueryProvider>
          </ErrorBoundary>
        </PerformanceOptimizer>
      </body>
    </html>
  )
}