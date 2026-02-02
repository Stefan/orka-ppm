/**
 * Phase 2 – Integration & Customizability: ERP sync proxy
 * Enterprise Readiness: Trigger SAP/CSV adapter sync via backend
 */

import { NextRequest, NextResponse } from 'next/server'
import { enterpriseFetch } from '@/lib/enterprise/api-client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || ''

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { adapter = 'csv', entity = 'commitments', organization_id } = body as {
      adapter?: string
      entity?: 'commitments' | 'actuals'
      organization_id?: string
    }

    if (!API_URL) {
      return NextResponse.json(
        { error: 'Backend not configured', synced_at: new Date().toISOString() },
        { status: 503 }
      )
    }

    const auth = request.headers.get('Authorization') || ''
    const res = await enterpriseFetch(`${API_URL}/api/v1/erp/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ adapter, entity, organization_id }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(data || { error: res.statusText }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: String(e), synced_at: new Date().toISOString() },
      { status: 500 }
    )
  }
}
