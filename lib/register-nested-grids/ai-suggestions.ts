/**
 * AI Suggestion Service - Column & Filter suggestions
 * Requirements: 2.6, 9.6
 */

import type { ItemType } from '@/components/register-nested-grids/types'
import { COLUMN_DEFINITIONS } from '@/components/register-nested-grids/COLUMN_DEFINITIONS'
import type { AISuggestion, Filter } from '@/components/register-nested-grids/types'

async function getSupabase() {
  const { supabase } = await import('@/lib/api/supabase-minimal')
  return supabase
}

export async function generateColumnSuggestions(
  itemType: ItemType
): Promise<AISuggestion[]> {
  const supabase = await getSupabase()
  const { data } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('item_type', itemType)
    .eq('suggestion_type', 'column_combination')
    .order('confidence', { ascending: false })
    .limit(5)

  if (data?.length) {
    return data.map((r) => ({
      type: 'column_combination' as const,
      confidence: Number(r.confidence ?? 0.8),
      suggestion: {
        columns: (r.suggestion_data as { columns?: string[] })?.columns,
        reason: (r.suggestion_data as { reason?: string })?.reason ?? 'Popular combination',
        popularity: (r.suggestion_data as { popularity?: number })?.popularity,
      },
    }))
  }

  const cols = COLUMN_DEFINITIONS[itemType] ?? []
  return [
    {
      type: 'column_combination',
      confidence: 0.85,
      suggestion: {
        columns: cols.slice(0, 5).map((c) => c.field),
        reason: 'Recommended default columns',
        popularity: 100,
      },
    },
  ]
}

export async function suggestFilters(itemType: ItemType): Promise<{ field: string; operator: string; value: unknown; reason: string }[]> {
  const supabase = await getSupabase()
  const { data } = await supabase
    .from('ai_suggestions')
    .select('*')
    .eq('item_type', itemType)
    .eq('suggestion_type', 'filter_preset')
    .order('usage_count', { ascending: false })
    .limit(5)

  if (data?.length) {
    return data.map((r) => {
      const d = r.suggestion_data as { field?: string; operator?: string; value?: unknown; reason?: string }
      return {
        field: d?.field ?? 'status',
        operator: d?.operator ?? 'equals',
        value: d?.value,
        reason: d?.reason ?? 'Frequently used',
      }
    })
  }

  return [
    { field: 'status', operator: 'equals', value: 'open', reason: 'Show open items' },
    { field: 'priority', operator: 'equals', value: 'high', reason: 'High priority only' },
  ]
}
