import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

/**
 * GET /api/workflows/instances/my-workflows
 * 
 * Fetches workflow instances where the current user is involved
 * (either as initiator or as an approver).
 * 
 * This endpoint proxies to the FastAPI backend to retrieve workflows
 * and filters them based on the authenticated user's context.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Extract query parameters for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = searchParams.get('limit') || '100'
    const offset = searchParams.get('offset') || '0'

    // Build query string for backend
    const queryParams = new URLSearchParams()
    if (status) queryParams.append('status', status)
    queryParams.append('limit', limit)
    queryParams.append('offset', offset)

    // First, get pending approvals for the user
    const pendingApprovalsUrl = `${BACKEND_URL}/workflows/approvals/pending?${queryParams.toString()}`
    
    const pendingResponse = await fetch(pendingApprovalsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!pendingResponse.ok) {
      const errorText = await pendingResponse.text()
      console.error('Backend pending approvals API error:', pendingResponse.status, errorText)
      
      // Return empty workflows list instead of failing completely
      return NextResponse.json({
        workflows: [],
        count: 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      })
    }

    const pendingData = await pendingResponse.json()
    const pendingApprovals = pendingData.approvals || []

    // Get unique workflow instance IDs from pending approvals
    const workflowInstanceIds = new Set(
      pendingApprovals.map((approval: any) => approval.workflow_instance_id)
    )

    // Fetch details for each workflow instance
    const workflowPromises = Array.from(workflowInstanceIds).map(async (instanceId) => {
      try {
        const instanceUrl = `${BACKEND_URL}/workflows/instances/${instanceId}`
        const instanceResponse = await fetch(instanceUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader,
          },
        })

        if (!instanceResponse.ok) {
          console.error(`Failed to fetch workflow instance ${instanceId}`)
          return null
        }

        const instanceData = await instanceResponse.json()
        
        // Get approvals for this instance
        const instanceApprovals = pendingApprovals.filter(
          (approval: any) => approval.workflow_instance_id === instanceId
        )

        // Transform to match frontend expected format
        return {
          id: instanceData.id,
          workflow_id: instanceData.workflow_id,
          workflow_name: instanceData.workflow_name || 'Workflow',
          entity_type: instanceData.entity_type,
          entity_id: instanceData.entity_id,
          current_step: instanceData.current_step || 0,
          status: instanceData.status,
          started_by: instanceData.started_by || instanceData.initiated_by,
          started_at: instanceData.started_at || instanceData.initiated_at,
          completed_at: instanceData.completed_at,
          approvals: instanceData.approvals || {},
          created_at: instanceData.created_at,
          updated_at: instanceData.updated_at
        }
      } catch (error) {
        console.error(`Error fetching workflow instance ${instanceId}:`, error)
        return null
      }
    })

    const workflows = (await Promise.all(workflowPromises)).filter(w => w !== null)

    return NextResponse.json({
      workflows,
      count: workflows.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('My workflows API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}
