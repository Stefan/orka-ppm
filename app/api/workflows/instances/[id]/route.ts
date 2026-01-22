import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

/**
 * GET /api/workflows/instances/[id]
 * 
 * Fetches detailed information about a specific workflow instance,
 * including all approval steps and their current status.
 * 
 * This endpoint proxies to the FastAPI backend workflow instance endpoint.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Forward request to backend
    const backendUrl = `${BACKEND_URL}/workflows/instances/${id}`
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend workflow instance API error:', response.status, errorText)
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Workflow instance not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch workflow instance from backend' },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    // Transform the response to match frontend expectations
    const transformedData = {
      id: data.id,
      workflow_id: data.workflow_id,
      workflow_name: data.workflow_name || 'Workflow',
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      current_step: data.current_step || 0,
      status: data.status,
      started_by: data.started_by || data.initiated_by,
      started_at: data.started_at || data.initiated_at,
      completed_at: data.completed_at,
      approvals: data.approvals || {},
      created_at: data.created_at,
      updated_at: data.updated_at,
      context: data.context || {}
    }
    
    return NextResponse.json(transformedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('Workflow instance API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflow instance' },
      { status: 500 }
    )
  }
}
