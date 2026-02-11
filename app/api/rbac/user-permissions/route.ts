/**
 * RBAC User Permissions API Endpoint
 * Proxies requests to backend for user permissions
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    // Forward request to backend
    const response = await fetch(`${BACKEND_URL}/api/rbac/user-permissions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend user-permissions error:', response.status, errorText)
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.warn('User permissions: backend unreachable', error instanceof Error ? error.message : error)
    return NextResponse.json({ roles: [], scopes: [], role_names: [], organization_scopes: [] }, { status: 200 })
  }
}
