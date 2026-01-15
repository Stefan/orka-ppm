/**
 * CursorTracker Component
 * 
 * Displays live cursor positions of other users during collaborative editing
 */

'use client'

import React from 'react'
import { MousePointer2 } from 'lucide-react'
import type { CursorPosition } from './types'

export interface CursorTrackerProps {
  cursors: Map<string, CursorPosition>
  currentUserId: string
  containerRef?: React.RefObject<HTMLElement>
}

export default function CursorTracker({
  cursors,
  currentUserId,
  containerRef
}: CursorTrackerProps) {
  // Filter out current user's cursor
  const otherCursors = Array.from(cursors.values()).filter(
    cursor => cursor.user_id !== currentUserId
  )

  if (otherCursors.length === 0) {
    return null
  }

  return (
    <>
      {otherCursors.map(cursor => (
        <div
          key={cursor.user_id}
          className="fixed pointer-events-none z-50 transition-all duration-100"
          style={{
            left: `${cursor.position.x}px`,
            top: `${cursor.position.y}px`,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {/* Cursor pointer */}
          <MousePointer2
            className="w-5 h-5 drop-shadow-lg"
            style={{ color: cursor.color }}
            fill={cursor.color}
          />
          
          {/* User name label */}
          <div
            className="absolute left-6 top-0 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.user_name}
          </div>
        </div>
      ))}
    </>
  )
}
