import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    const response = await fetch(`${BACKEND_URL}/api/admin/cache/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      }
    })

    if (!response.ok) {
      // Return empty stats if endpoint doesn't exist
      if (response.status === 404) {
        return NextResponse.json({ hits: 0, misses: 0, size: 0 })
      }
      const errorText = await response.text()
      return NextResponse.json({ error: errorText }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error proxying cache stats:', error)
    return NextResponse.json({ hits: 0, misses: 0, size: 0 })
  }
}
