/**
 * Project Import API Endpoint
 * Handles both JSON and CSV project imports by proxying to backend API
 * 
 * Requirements:
 * - 1.3: Missing/invalid auth credentials return 401
 * - 1.4: User lacking data_import permission returns 403
 * - 1.5: Accept requests at `/api/projects/import` using POST
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
 * Determine if the request is a CSV upload based on content type
 */
function isCSVUpload(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type') || ''
  return contentType.includes('multipart/form-data')
}

/**
 * POST handler for project imports
 * Supports both JSON array imports and CSV file uploads
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
    
    // Determine import type based on content type
    const isCSV = isCSVUpload(request)
    const searchParams = new URL(request.url).searchParams
    const queryString = searchParams.toString()

    // Build backend URL based on import type (forward query params: anonymize, clear_before_import)
    const backendUrl = isCSV
      ? `${BACKEND_URL}/api/projects/import/csv${queryString ? `?${queryString}` : ''}`
      : `${BACKEND_URL}/api/projects/import${queryString ? `?${queryString}` : ''}`
    
    // Prepare headers for backend request
    const backendHeaders: HeadersInit = {
      'Authorization': `Bearer ${token}`
    }
    
    // Prepare request body based on content type
    let backendBody: BodyInit
    
    if (isCSV) {
      // For CSV uploads, forward the FormData
      backendBody = await request.formData()
    } else {
      // For JSON imports, forward the JSON body
      backendHeaders['Content-Type'] = 'application/json'
      backendBody = await request.text()
    }
    
    // Proxy request to backend API
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: backendHeaders,
      body: backendBody
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
    console.error('Project import API error:', error)
    
    return NextResponse.json(
      {
        success: false,
        count: 0,
        errors: [],
        message: error instanceof Error ? error.message : 'Internal server error during import'
      },
      { status: 500 }
    )
  }
}
