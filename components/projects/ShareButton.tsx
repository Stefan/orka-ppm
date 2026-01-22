/**
 * ShareButton Component
 * 
 * A button that opens the ShareLinkManager in a modal dialog.
 * Can be integrated into project headers and action menus.
 */

'use client'

import React, { useState } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import ShareLinkManager from './ShareLinkManager'

interface ShareButtonProps {
  projectId: string
  projectName: string
  userPermissions: string[]
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

/**
 * ShareButton Component
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  projectId,
  projectName,
  userPermissions,
  variant = 'secondary',
  size = 'md',
  showLabel = true,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={className}
      >
        <Share2 className="h-4 w-4" />
        {showLabel && <span className="ml-2">Share</span>}
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Share Project"
        size="xl"
      >
        <ShareLinkManager
          projectId={projectId}
          projectName={projectName}
          userPermissions={userPermissions}
        />
      </Modal>
    </>
  )
}

export default ShareButton
