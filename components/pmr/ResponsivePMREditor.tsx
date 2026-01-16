'use client'

import React, { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { PMRReport } from './types'

// Lazy load components for better performance
const PMREditor = dynamic(() => import('./PMREditor'), {
  loading: () => <div className="flex items-center justify-center h-full">Loading editor...</div>,
  ssr: false
})

const MobilePMREditor = dynamic(() => import('./MobilePMREditor'), {
  loading: () => <div className="flex items-center justify-center h-full">Loading mobile editor...</div>,
  ssr: false
})

export interface ResponsivePMREditorProps {
  report: PMRReport
  onSave: (report: PMRReport) => void
  onSectionUpdate: (sectionId: string, content: any) => void
  onRequestAISuggestion?: (sectionId: string, context: string) => Promise<any[]>
  collaborationSession?: any
  onCollaborationEvent?: (event: any) => void
  isReadOnly?: boolean
  className?: string
}

/**
 * Responsive PMR Editor
 * 
 * Automatically switches between desktop and mobile optimized editors
 * based on screen size and device capabilities
 */
const ResponsivePMREditor: React.FC<ResponsivePMREditorProps> = ({
  report,
  onSave,
  onSectionUpdate,
  onRequestAISuggestion,
  collaborationSession,
  onCollaborationEvent,
  isReadOnly = false,
  className = ''
}) => {
  // Detect device type
  const isMobile = useMediaQuery('(max-width: 767px)')
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  // Determine which editor to use
  const useMobileEditor = isMobile || (isTablet && isTouchDevice)

  // Render appropriate editor
  if (useMobileEditor) {
    return (
      <MobilePMREditor
        report={report}
        onSave={onSave}
        onSectionUpdate={onSectionUpdate}
        className={className}
      />
    )
  }

  return (
    <PMREditor
      report={report}
      onSave={onSave}
      onSectionUpdate={onSectionUpdate}
      onRequestAISuggestion={onRequestAISuggestion || (async () => [])}
      collaborationSession={collaborationSession}
      onCollaborationEvent={onCollaborationEvent}
      isReadOnly={isReadOnly}
      className={className}
    />
  )
}

export default ResponsivePMREditor
