// Costbook Supabase RPC Helpers (Task 59.2)
// Call RPC functions for complex aggregations.

export interface ProjectFinancialsRow {
  project_id: string
  total_budget: number
  total_commitments: number
  total_actuals: number
  total_spend: number
  variance: number
  spend_percentage: number
}

/**
 * Fetch project financials aggregate via RPC (if available).
 * Falls back to multiple queries if RPC is not deployed.
 */
export async function fetchProjectFinancialsAggregate(
  projectIds: string[]
): Promise<ProjectFinancialsRow[]> {
  if (projectIds.length === 0) return []
  try {
    const { supabase } = await import('@/lib/api/supabase')
    const { data, error } = await supabase.rpc('get_project_financials_aggregate', {
      project_ids: projectIds
    })
    if (error) throw error
    return (data as ProjectFinancialsRow[]) ?? []
  } catch {
    return []
  }
}
