/**
 * Register Nested Grids API functions
 * Requirements: 4.2, 6.4, 7.3, 8.3
 */

import type { NestedGridConfigModel, ItemType } from '@/components/register-nested-grids/types'

async function getSupabase() {
  const { supabase } = await import('@/lib/api/supabase-minimal')
  return supabase
}

export async function fetchNestedGridConfig(registerId: string): Promise<NestedGridConfigModel | null> {
  const supabase = await getSupabase()
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session?.user) return null

  const { data: config } = await supabase
    .from('nested_grid_configs')
    .select('*')
    .eq('register_id', registerId)
    .single()

  if (!config) return null

  const { data: sections } = await supabase
    .from('nested_grid_sections')
    .select('*, nested_grid_columns(*)')
    .eq('config_id', config.id)
    .order('display_order')

  return {
    id: config.id,
    registerId: config.register_id,
    enableLinkedItems: config.enable_linked_items ?? false,
    sections: (sections || []).map((s) => ({
      id: s.id,
      configId: s.config_id,
      itemType: s.item_type as ItemType,
      displayOrder: s.display_order,
      columns: (s.nested_grid_columns || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        sectionId: c.section_id,
        field: c.field,
        headerName: c.header_name,
        width: c.width,
        editable: c.editable ?? false,
        displayOrder: c.display_order,
        createdAt: c.created_at,
      })),
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
    createdAt: config.created_at,
    updatedAt: config.updated_at,
  }
}

export async function fetchNestedGridData(
  parentRowId: string,
  itemType: ItemType
): Promise<Record<string, unknown>[]> {
  const supabase = await getSupabase()
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session?.user) return []

  if (itemType === 'tasks') {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', parentRowId)
    return data || []
  }
  if (itemType === 'registers' || itemType === 'cost_registers') {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('id', parentRowId)
    return data ? [data] : []
  }
  return []
}

export async function updateNestedGridItem(
  rowId: string,
  field: string,
  value: unknown,
  itemType?: ItemType
): Promise<Record<string, unknown>> {
  const supabase = await getSupabase()
  const table = itemType === 'tasks' ? 'tasks' : 'projects'
  const { data, error } = await supabase
    .from(table)
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', rowId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function reorderNestedGridRows(
  parentRowId: string,
  rowIds: string[],
  itemType?: ItemType
): Promise<void> {
  if (itemType !== 'tasks') return
  const supabase = await getSupabase()
  for (let i = 0; i < rowIds.length; i++) {
    await supabase.from('tasks').update({ sort_order: i }).eq('id', rowIds[i])
  }
}
