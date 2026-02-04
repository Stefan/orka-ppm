/**
 * Permission Check Service
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

async function getSupabase() {
  const { supabase } = await import('@/lib/api/supabase-minimal')
  return supabase
}

export type PermissionAction = 'view' | 'edit' | 'delete' | 'reorder'

export interface PermissionAlternative {
  type: 'summary' | 'limited_view' | 'request_access'
  message: string
  data?: unknown
}

export async function checkPermission(
  resourceId: string,
  action: PermissionAction,
  userId?: string
): Promise<boolean> {
  const supabase = await getSupabase()
  const { data: session } = await supabase.auth.getSession()
  const uid = userId ?? session?.session?.user?.id
  if (!uid) return false

  if (action === 'view') return true
  if (action === 'edit' || action === 'reorder') return true
  if (action === 'delete') return true

  return false
}

export async function getAlternative(
  resourceId: string,
  action: PermissionAction
): Promise<PermissionAlternative | null> {
  const hasAccess = await checkPermission(resourceId, action)
  if (hasAccess) return null

  return {
    type: 'summary',
    message: 'Show summary instead of details',
    data: { fallback: 'summary' },
  }
}
