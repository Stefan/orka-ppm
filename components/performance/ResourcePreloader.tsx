/**
 * ResourcePreloader Component
 * 
 * Initializes resource preloading on app mount to improve performance
 */

'use client'

import { useEffect } from 'react'
import { initializeResourcePreloading } from '../../lib/utils/resource-preloader'

export function ResourcePreloader() {
  useEffect(() => {
    // Initialize resource preloading on mount
    initializeResourcePreloading()
  }, [])
  
  // This component doesn't render anything
  return null
}
