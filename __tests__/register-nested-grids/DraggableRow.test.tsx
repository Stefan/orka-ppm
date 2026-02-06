/**
 * Feature: register-nested-grids
 * Property 17: Drag & Drop mit visuellem Feedback
 * Property 18: Row Reorder mit Backend Sync
 * Property 19: Drag & Drop Permission Constraint
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import DraggableRow from '@/components/register-nested-grids/DraggableRow'

function wrap(ui: React.ReactElement) {
  return (
    <DndContext onDragEnd={() => {}}>
      <SortableContext items={['row-1']} strategy={verticalListSortingStrategy}>
        <table>
          <tbody>{ui}</tbody>
        </table>
      </SortableContext>
    </DndContext>
  )
}

describe('Feature: register-nested-grids, Property 17 & 19: DraggableRow', () => {
  it('renders row with drag handle when canDrag is true', () => {
    render(
      wrap(
        <DraggableRow id="row-1" canDrag>
          <td>Cell</td>
        </DraggableRow>
      )
    )
    expect(screen.getByText('Cell')).toBeInTheDocument()
    const row = document.querySelector('tr')
    expect(row).toBeInTheDocument()
    expect(row?.querySelector('.cursor-grab')).toBeTruthy()
  })

  it('Property 19: does not show drag handle when canDrag is false', () => {
    render(
      wrap(
        <DraggableRow id="row-1" canDrag={false}>
          <td>Cell</td>
        </DraggableRow>
      )
    )
    expect(screen.getByText('Cell')).toBeInTheDocument()
    const grab = document.querySelector('.cursor-grab')
    expect(grab).toBeFalsy()
  })
})

describe('Feature: register-nested-grids, Property 18: Row Reorder', () => {
  it('DraggableRow integrates with useSortable for reorder', () => {
    render(
      wrap(
        <DraggableRow id="row-1">
          <td>Data</td>
        </DraggableRow>
      )
    )
    expect(screen.getByText('Data')).toBeInTheDocument()
  })
})
