/**
 * CSV Import History API Endpoint
 * Proxies to backend import_audit_logs so real project/commitments/actuals imports appear.
 * Frontend expects response.imports (array).
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const { searchParams } = new URL(request.url)
    const backendUrl = `${BACKEND_URL.replace(/\/$/, '')}/csv-import/history?${searchParams.toString()}`

    const res = await fetch(backendUrl, {
      headers: {
        ...(authHeader ? { Authorization: authHeader } : {}),
        'Content-Type': 'application/json',
      },
    })

    if (res.ok) {
      const data = await res.json()
      // Backend returns { imports: [...] }; frontend uses data.imports
      return NextResponse.json(data, { status: 200 })
    }

    // Backend error or unreachable: return empty list so UI shows "Noch keine Imports"
    if (res.status >= 500 || res.status === 404) {
      return NextResponse.json({ imports: [] }, { status: 200 })
    }
    const err = await res.json().catch(() => ({}))
    return NextResponse.json(
      { error: 'Failed to retrieve CSV import history', ...err },
      { status: res.status }
    )
  } catch (error) {
    console.error('CSV import history error:', error)
    return NextResponse.json({ imports: [] }, { status: 200 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('importId')
    if (!importId) {
      return NextResponse.json({ error: 'Missing required parameter: importId' }, { status: 400 })
    }
    // Backend has no delete endpoint for import history; deletion not implemented
    return NextResponse.json(
      { error: 'Import history deletion is not implemented' },
      { status: 501 }
    )
  } catch (error) {
    console.error('CSV import history deletion error:', error)
    return NextResponse.json({
      error: 'Failed to delete import record',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}