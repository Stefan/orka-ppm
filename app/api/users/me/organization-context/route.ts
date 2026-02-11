/**
 * Current user's organization context for RLS / UI (organizationId, path, isAdmin).
 * Proxies to backend: user-permissions + organizations/me.
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export interface OrganizationContext {
  organizationId: string | null
  organizationPath: string | null
  isAdmin: boolean
}

const defaultContext: OrganizationContext = {
  organizationId: null,
  organizationPath: null,
  isAdmin: false,
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const headers = { 'Content-Type': 'application/json', 'Authorization': authHeader }

    let permRes: Response
    let meRes: Response
    try {
      ;[permRes, meRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/rbac/user-permissions`, { method: 'GET', headers }),
        fetch(`${BACKEND_URL}/api/admin/organizations/me`, { method: 'GET', headers }),
      ])
    } catch (e) {
      console.warn('Organization context: backend unreachable, using default', (e as Error)?.message ?? e)
      return NextResponse.json(defaultContext, { status: 200 })
    }

    let isAdmin = false
    let organizationId: string | null = null

    if (permRes.ok) {
      try {
        const perms = await permRes.json()
        const roles = (perms?.roles ?? perms?.role_names ?? []) as string[]
        isAdmin = roles.some((r: string) => r === 'super_admin' || r === 'admin')
        const scopes = (perms?.scopes ?? perms?.organization_scopes ?? []) as Array<{ scope_type?: string; scope_id?: string }>
        const orgScope = scopes.find((s: { scope_type?: string }) => s?.scope_type === 'organization')
        if (orgScope?.scope_id) organizationId = orgScope.scope_id
      } catch {
        // ignore parse errors
      }
    }

    let organizationPath: string | null = null
    if (meRes.ok) {
      try {
        const me = await meRes.json()
        if (me?.id) organizationId = organizationId ?? me.id
        if (me?.path != null) organizationPath = typeof me.path === 'string' ? me.path : String(me.path)
      } catch {
        // ignore parse errors
      }
    }

    const body: OrganizationContext = {
      organizationId,
      organizationPath,
      isAdmin,
    }
    return NextResponse.json(body)
  } catch (e) {
    console.warn('Organization context: backend unreachable, using default', (e as Error)?.message ?? e)
    return NextResponse.json(defaultContext, { status: 200 })
  }
}
