/**
 * CSV Project Import API Endpoint
 * Dedicated endpoint for CSV file uploads
 * 
 * Requirements:
 * - 1.3: Missing/invalid auth credentials return 401
 * - 1.4: User lacking data_import permission returns 403
 * - 2.4: Accept CSV uploads at `/api/projects/import/csv` using POST
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

/**
 * Extract authentication token from request
 * Checks Authorization header first, then falls back to cookies
 */
function getAuthToken(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // Fall back to cookie
  const tokenCookie = request.cookies.get('auth_token')
  if (tokenCookie?.value) {
    return tokenCookie.value
  }
  
  // Also check for Supabase session cookie
  const supabaseToken = request.cookies.get('sb-access-token')
  if (supabaseToken?.value) {
    return supabaseToken.value
  }
  
  return null
}

/**
 * POST handler for CSV project imports
 * Accepts multipart/form-data with CSV file
 */
export async function POST(request: NextRequest) {
  try {
    // Extract authentication token
    const token = getAuthToken(request)
    
    if (!token) {
      return NextResponse.json(
        { 
          success: false,
          count: 0,
          errors: [],
          message: 'Authentication required. Please provide a valid token.'
        },
        { status: 401 }
      )
    }
    
    // Verify content type is multipart/form-data for CSV uploads
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        {
          success: false,
          count: 0,
          errors: [],
          message: 'Invalid content type. CSV uploads must use multipart/form-data.'
        },
        { status: 400 }
      )
    }
    
    // Build backend URL for CSV import
    const backendUrl = `${BACKEND_URL}/api/projects/import/csv`
    
    // Get the form data from the request
    const formData = await request.formData()
    
    // Proxy request to backend API
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    
    // Parse backend response
    let data
    const responseText = await response.text()
    
    try {
      data = JSON.parse(responseText)
    } catch {
      // If response is not JSON, wrap it in error format
      data = {
        success: false,
        count: 0,
        errors: [],
        message: responseText || 'Unknown error from backend'
      }
    }
    
    // Handle specific HTTP status codes
    if (response.status === 401) {
      return NextResponse.json(
        {
          success: false,
          count: 0,
          errors: [],
          message: data.message || data.detail || 'Invalid or expired authentication token'
        },
        { status: 401 }
      )
    }
    
    if (response.status === 403) {
      return NextResponse.json(
        {
          success: false,
          count: 0,
          errors: [],
          message: data.message || data.detail || 'Insufficient permissions. The data_import permission is required.'
        },
        { status: 403 }
      )
    }
    
    // Return backend response with appropriate status
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
  } catch (error) {
    console.error('CSV project import API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        count: 0,
        errors: [],
        message: error instanceof Error ? error.message : 'Internal server error during CSV import'
      },
      { status: 500 }
    )
  }
}
