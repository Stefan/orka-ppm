'use client'

import { useEffect } from 'react'

/**
 * Performance optimization component
 * Handles various performance improvements
 */
export default function PerformanceOptimizer() {
  useEffect(() => {
    // Remove console logs in production and filter third-party warnings
    if (process.env.NODE_ENV === 'production') {
      const originalWarn = console.warn
      console.log = () => {}
      console.warn = (...args) => {
        // Filter out Vercel's zustand deprecation warning
        const message = args.join(' ')
        if (message.includes('Default export is deprecated') && message.includes('zustand')) {
          return // Ignore this third-party warning
        }
        originalWarn.apply(console, args)
      }
      console.info = () => {}
    } else {
      // In development, filter the zustand warning but keep other warnings
      const originalWarn = console.warn
      console.warn = (...args) => {
        const message = args.join(' ')
        if (message.includes('Default export is deprecated') && message.includes('zustand')) {
          return // Ignore this third-party warning in development too
        }
        originalWarn.apply(console, args)
      }
    }

    // Optimize images loading
    const images = document.querySelectorAll('img[loading="lazy"]')
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            if (img.dataset.src) {
              img.src = img.dataset.src
              img.removeAttribute('data-src')
              imageObserver.unobserve(img)
            }
          }
        })
      })
      
      images.forEach((img) => imageObserver.observe(img))
    }

    // Preload critical resources
    const preloadCriticalResources = () => {
      // Use actual backend endpoints that exist
      const criticalResources = [
        '/projects',
        '/resources/',
        '/feedback/features',
        '/optimized/dashboard/quick-stats',
        '/portfolios/metrics'
      ]
      
      criticalResources.forEach((resource) => {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = `https://orka-ppm.onrender.com${resource}`
        document.head.appendChild(link)
      })
    }

    // Delay non-critical resource preloading
    setTimeout(preloadCriticalResources, 2000)

    // Cleanup function
    return () => {
      // Cleanup observers if needed
    }
  }, [])

  return null // This component doesn't render anything
}