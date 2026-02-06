/**
 * Register Nested Grids API functions
 * Requirements: 4.2, 5.5, 6.4, 7.3, 8.3, 9.2
 */

import type {
  NestedGridConfigModel,
  ItemType,
  NestedGridConfig,
  UserStateModel,
  ScrollPosition,
  FilterState,
} from '@/components/register-nested-grids/types'
import { validateNestedGridConfig } from '@/components/register-nested-grids/validation'

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

/**
 * Save nested grid config to Supabase (Admin Panel).
 * Validates config, then upserts config + sections + columns.
 * Requirements: 5.5
 */
export async function saveNestedGridConfig(
  registerId: string,
  config: NestedGridConfig
): Promise<NestedGridConfigModel> {
  const validation = validateNestedGridConfig(config)
  if (!validation.valid) throw new Error(validation.message ?? 'Invalid config')

  const supabase = await getSupabase()
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session?.user) throw new Error('Unauthorized')

  const existing = await fetchNestedGridConfig(registerId)
  let configId: string

  if (existing) {
    const { error: updateErr } = await supabase
      .from('nested_grid_configs')
      .update({
        enable_linked_items: config.enableLinkedItems,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updateErr) throw updateErr
    configId = existing.id
    const { error: delErr } = await supabase
      .from('nested_grid_sections')
      .delete()
      .eq('config_id', configId)
    if (delErr) throw delErr
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('nested_grid_configs')
      .insert({ register_id: registerId, enable_linked_items: config.enableLinkedItems })
      .select('id')
      .single()
    if (insErr) throw insErr
    configId = inserted.id
  }

  for (let i = 0; i < config.sections.length; i++) {
    const sec = config.sections[i]
    const { data: sectionRow, error: secErr } = await supabase
      .from('nested_grid_sections')
      .insert({
        config_id: configId,
        item_type: sec.itemType,
        display_order: sec.displayOrder,
      })
      .select('id')
      .single()
    if (secErr) throw secErr
    for (let j = 0; j < sec.columns.length; j++) {
      const col = sec.columns[j]
      const { error: colErr } = await supabase.from('nested_grid_columns').insert({
        section_id: sectionRow.id,
        field: col.field,
        header_name: col.headerName,
        width: col.width ?? null,
        editable: col.editable ?? false,
        display_order: col.order ?? j,
      })
      if (colErr) throw colErr
    }
  }

  const saved = await fetchNestedGridConfig(registerId)
  if (!saved) throw new Error('Failed to load saved config')
  return saved
}

/**
 * Load user state (expanded rows, scroll position) for a register.
 * Requirements: 9.2
 */
export async function loadNestedGridUserState(
  registerId: string
): Promise<UserStateModel | null> {
  const supabase = await getSupabase()
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session?.user) return null

  const { data } = await supabase
    .from('nested_grid_user_state')
    .select('*')
    .eq('register_id', registerId)
    .eq('user_id', session.session.user.id)
    .single()

  if (!data) return null
  const expanded = (data.expanded_rows as string[] | null) ?? []
  return {
    id: data.id,
    userId: data.user_id,
    registerId: data.register_id,
    expandedRows: Array.isArray(expanded) ? expanded : [],
    scrollPosition: (data.scroll_position as ScrollPosition | null) ?? null,
    filterState: (data.filter_state as UserStateModel['filterState']) ?? null,
    lastViewedAt: data.last_viewed_at,
  }
}

/**
 * Save user state (expanded rows, scroll position, filter state) for a register.
 * Requirements: 9.2, 16.5
 */
export async function saveNestedGridUserState(
  registerId: string,
  payload: {
    expandedRows?: string[]
    scrollPosition?: ScrollPosition | null
    filterState?: FilterState | null
  }
): Promise<void> {
  const supabase = await getSupabase()
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session?.user) return

  const row: Record<string, unknown> = {
    user_id: session.session.user.id,
    register_id: registerId,
    last_viewed_at: new Date().toISOString(),
  }
  if (payload.expandedRows !== undefined) row.expanded_rows = payload.expandedRows
  if (payload.scrollPosition !== undefined) row.scroll_position = payload.scrollPosition
  if (payload.filterState !== undefined) row.filter_state = payload.filterState

  await supabase.from('nested_grid_user_state').upsert(row, {
    onConflict: 'user_id,register_id',
  })
}
