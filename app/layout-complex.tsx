import React from 'react'
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SupabaseAuthProvider } from './providers/SupabaseAuthProvider'
import ErrorBoundary from '../components/ErrorBoundary'
import PerformanceOptimizer from '../components/PerformanceOptimizer'

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
    <html lang="de" className={inter.variable}>
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
        <link rel="preload" href="/icon.svg" as="image" type="image/svg+xml" />
        
        {/* Icons */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/svg+xml" sizes="32x32" href="/favicon-32x32.svg" />
        <link rel="icon" type="image/svg+xml" sizes="16x16" href="/favicon-16x16.svg" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#2563eb" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning={true}>
        <PerformanceOptimizer />
        <ErrorBoundary>
          <SupabaseAuthProvider>
            {children}
          </SupabaseAuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}