import React from 'react'
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SupabaseAuthProvider } from './providers/SupabaseAuthProvider'
import { ErrorBoundary } from '../components/shared/ErrorBoundary'
import PerformanceOptimizer from '../components/performance/PerformanceOptimizer'
import { ResourcePreloader } from '../components/performance/ResourcePreloader'
import PredictivePrefetcher from '../components/performance/PredictivePrefetcher'
import FirefoxSidebarFix from '../components/navigation/FirefoxSidebarFix'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
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
    <html lang="de" className={`${inter.variable} chrome-optimized`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Orka PPM" />
        <meta name="application-name" content="Orka PPM" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://orka-ppm.onrender.com" />
        <link rel="dns-prefetch" href="https://orka-ppm.onrender.com" />
        
        {/* Preload critical fonts - Inter is loaded via next/font/google with automatic optimization */}
        {/* Next.js automatically inlines and optimizes Google Fonts, no manual preload needed */}
        
        {/* Preload critical icons for faster LCP */}
        <link rel="preload" href="/icon.svg" as="image" type="image/svg+xml" />
        <link rel="preload" href="/apple-touch-icon.png" as="image" type="image/png" />
        
        {/* Preload critical CSS - Next.js handles this automatically via CSS-in-JS */}
        {/* Preload critical JavaScript - Next.js handles this automatically via code splitting */}
        
        {/* Icons with proper dimensions */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="icon" type="image/svg+xml" sizes="32x32" href="/favicon-32x32.svg" />
        <link rel="icon" type="image/svg+xml" sizes="16x16" href="/favicon-16x16.svg" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#2563eb" />
        

      </head>
      <body 
        className="font-sans antialiased bg-white min-h-screen chrome-optimized chrome-background-coverage" 
        suppressHydrationWarning={true}
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          backgroundAttachment: 'local',
          backgroundColor: '#ffffff'
        } as React.CSSProperties}
      >
        <FirefoxSidebarFix />
        <ResourcePreloader />
        <PredictivePrefetcher enabled={true} />
        <PerformanceOptimizer>
          <ErrorBoundary>
            <SupabaseAuthProvider>
              {children}
            </SupabaseAuthProvider>
          </ErrorBoundary>
        </PerformanceOptimizer>
      </body>
    </html>
  )
}