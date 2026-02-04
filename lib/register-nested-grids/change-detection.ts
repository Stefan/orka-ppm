/**
 * Change Detection Service - Compare previous vs current
 * Requirements: 5.3, 5.4
 */

import type { ChangeHighlight, ItemType } from '@/components/register-nested-grids/types'

async function getSupabase() {
  const { supabase } = await import('@/lib/api/supabase-minimal')
  return supabase
}

export function detectChanges(
  previous: Record<string, unknown>[],
  current: Record<string, unknown>[],
  idField = 'id'
): ChangeHighlight[] {
  const prevMap = new Map(previous.map((r) => [String(r[idField]), r]))
  const currMap = new Map(current.map((r) => [String(r[idField]), r]))
  const highlights: ChangeHighlight[] = []

  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id)
    if (!prev) {
      highlights.push({
        rowId: id,
        field: idField,
        changeType: 'added',
        currentValue: curr,
        timestamp: new Date(),
      })
    } else {
      for (const key of Object.keys(curr)) {
        if (prev[key] !== curr[key]) {
          highlights.push({
            rowId: id,
            field: key,
            changeType: 'modified',
            previousValue: prev[key],
            currentValue: curr[key],
            timestamp: new Date(),
          })
        }
      }
    }
  }
  for (const [id] of prevMap) {
    if (!currMap.has(id)) {
      highlights.push({
        rowId: id,
        field: idField,
        changeType: 'deleted',
        timestamp: new Date(),
      })
    }
  }
  return highlights
}

export async function saveChanges(
  parentRowId: string,
  itemType: ItemType,
  highlights: ChangeHighlight[]
): Promise<void> {
  const supabase = await getSupabase()
  for (const h of highlights) {
    await supabase.from('nested_grid_changes').insert({
      parent_row_id: parentRowId,
      item_type: itemType,
      row_id: h.rowId,
      field: h.field,
      change_type: h.changeType,
      previous_value: h.previousValue,
      current_value: h.currentValue,
    })
  }
}
