'use client'

/**
 * Draggable Row using @dnd-kit
 * Requirements: 8.1, 8.2, 8.5
 */

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface DraggableRowProps {
  id: string
  canDrag?: boolean
  children: React.ReactNode
}

export default function DraggableRow({ id, canDrag = true, children }: DraggableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !canDrag })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'bg-gray-100' : ''}>
      {canDrag && (
        <td className="w-8 p-1 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4 text-gray-400" />
        </td>
      )}
      {children}
    </tr>
  )
}
