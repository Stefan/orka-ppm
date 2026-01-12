'use client'

import React, { useEffect, useRef } from 'react'

interface LandmarkNavigationProps {
  children: React.ReactNode
}

/**
 * LandmarkNavigation component provides ARIA landmarks and navigation structure
 */
export default function LandmarkNavigation({ children }: LandmarkNavigationProps) {
  const landmarkNavRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Ensure all major sections have proper landmarks
    const ensureLandmarks = () => {
      // Main content area
      const mainContent = document.querySelector('main')
      if (mainContent && !mainContent.getAttribute('role')) {
        mainContent.setAttribute('role', 'main')
        mainContent.setAttribute('aria-label', 'Main content')
        if (!mainContent.id) {
          mainContent.id = 'main-content'
        }
      }

      // Navigation areas
      const navElements = document.querySelectorAll('nav')
      navElements.forEach((nav, index) => {
        if (!nav.getAttribute('role')) {
          nav.setAttribute('role', 'navigation')
        }
        if (!nav.getAttribute('aria-label')) {
          if (nav.closest('.sidebar') || nav.classList.contains('sidebar')) {
            nav.setAttribute('aria-label', 'Main navigation')
          } else {
            nav.setAttribute('aria-label', `Navigation ${index + 1}`)
          }
        }
        if (!nav.id) {
          nav.id = index === 0 ? 'navigation' : `navigation-${index + 1}`
        }
      })

      // Search areas
      const searchElements = document.querySelectorAll('[data-search-input], [type="search"], .search-container')
      searchElements.forEach((search, index) => {
        if (!search.getAttribute('role')) {
          search.setAttribute('role', 'search')
        }
        if (!search.getAttribute('aria-label')) {
          search.setAttribute('aria-label', 'Search')
        }
        if (!search.id) {
          search.id = index === 0 ? 'search' : `search-${index + 1}`
        }
      })

      // Banner/header areas
      const headerElements = document.querySelectorAll('header')
      headerElements.forEach((header) => {
        if (!header.getAttribute('role')) {
          header.setAttribute('role', 'banner')
        }
        if (!header.getAttribute('aria-label')) {
          header.setAttribute('aria-label', 'Page header')
        }
      })

      // Footer areas
      const footerElements = document.querySelectorAll('footer')
      footerElements.forEach((footer) => {
        if (!footer.getAttribute('role')) {
          footer.setAttribute('role', 'contentinfo')
        }
        if (!footer.getAttribute('aria-label')) {
          footer.setAttribute('aria-label', 'Page footer')
        }
      })

      // Complementary content (sidebars, aside content)
      const asideElements = document.querySelectorAll('aside')
      asideElements.forEach((aside, index) => {
        if (!aside.getAttribute('role')) {
          aside.setAttribute('role', 'complementary')
        }
        if (!aside.getAttribute('aria-label')) {
          aside.setAttribute('aria-label', `Sidebar content ${index + 1}`)
        }
      })
    }

    // Run on mount and when DOM changes
    ensureLandmarks()
    
    // Set up mutation observer to handle dynamic content
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldUpdate = true
        }
      })
      if (shouldUpdate) {
        setTimeout(ensureLandmarks, 100) // Debounce
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="landmark-navigation">
      {/* Landmark navigation for screen readers */}
      <nav 
        ref={landmarkNavRef}
        className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:top-0 focus-within:left-0 focus-within:z-50 focus-within:bg-white focus-within:p-4 focus-within:shadow-lg"
        aria-label="Landmark navigation"
      >
        <h2 className="text-lg font-semibold mb-2">Page landmarks</h2>
        <ul className="space-y-1">
          <li>
            <a 
              href="#main-content" 
              className="text-blue-600 hover:text-blue-800 underline"
              onClick={(e) => {
                e.preventDefault()
                const target = document.getElementById('main-content')
                if (target) {
                  target.focus()
                  target.scrollIntoView({ behavior: 'smooth' })
                }
              }}
            >
              Main content
            </a>
          </li>
          <li>
            <a 
              href="#navigation" 
              className="text-blue-600 hover:text-blue-800 underline"
              onClick={(e) => {
                e.preventDefault()
                const target = document.getElementById('navigation')
                if (target) {
                  target.focus()
                  target.scrollIntoView({ behavior: 'smooth' })
                }
              }}
            >
              Navigation menu
            </a>
          </li>
          <li>
            <a 
              href="#search" 
              className="text-blue-600 hover:text-blue-800 underline"
              onClick={(e) => {
                e.preventDefault()
                const target = document.getElementById('search')
                if (target) {
                  target.focus()
                  target.scrollIntoView({ behavior: 'smooth' })
                }
              }}
            >
              Search
            </a>
          </li>
        </ul>
      </nav>

      {children}
    </div>
  )
}

/**
 * SkipLink component for creating accessible skip navigation
 */
export function SkipLink({ 
  href, 
  children 
}: { 
  href: string
  children: React.ReactNode 
}) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded focus:z-50 focus:font-medium focus:no-underline"
      onClick={(e) => {
        e.preventDefault()
        const targetId = href.replace('#', '')
        const target = document.getElementById(targetId)
        if (target) {
          target.focus()
          target.scrollIntoView({ behavior: 'smooth' })
        }
      }}
    >
      {children}
    </a>
  )
}

/**
 * Landmark component for wrapping content with proper ARIA landmarks
 */
export function Landmark({ 
  as = 'div',
  role,
  label,
  labelledBy,
  describedBy,
  children,
  className = '',
  ...props
}: {
  as?: keyof JSX.IntrinsicElements
  role?: string
  label?: string
  labelledBy?: string
  describedBy?: string
  children: React.ReactNode
  className?: string
  [key: string]: any
}) {
  const Component = as as any

  return (
    <Component
      role={role}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={className}
      {...props}
    >
      {children}
    </Component>
  )
}