import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

/**
 * POST /api/workflows/instances/[id]/approve
 * 
 * Submits an approval decision (approve or reject) for a workflow instance.
 * The backend will validate that the user is authorized to approve this workflow
 * and will advance the workflow to the next step if appropriate.
 * 
 * Request body:
 * {
 *   "decision": "approved" | "rejected",
 *   "comments": "optional comments"
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { decision, comments } = body

    // Validate decision
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be "approved" or "rejected"' },
        { status: 400 }
      )
    }

    // First, get the workflow instance to find pending approvals for the current user
    const instanceUrl = `${BACKEND_URL}/workflows/instances/${id}`
    
    const instanceResponse = await fetch(instanceUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!instanceResponse.ok) {
      const errorText = await instanceResponse.text()
      console.error('Failed to fetch workflow instance:', instanceResponse.status, errorText)
      
      if (instanceResponse.status === 404) {
        return NextResponse.json(
          { error: 'Workflow instance not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch workflow instance' },
        { status: instanceResponse.status }
      )
    }

    const instanceData = await instanceResponse.json()

    // Get pending approvals for the current user
    const pendingApprovalsUrl = `${BACKEND_URL}/workflows/approvals/pending`
    
    const pendingResponse = await fetch(pendingApprovalsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!pendingResponse.ok) {
      const errorText = await pendingResponse.text()
      console.error('Failed to fetch pending approvals:', pendingResponse.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch pending approvals' },
        { status: pendingResponse.status }
      )
    }

    const pendingData = await pendingResponse.json()
    const pendingApprovals = pendingData.approvals || []

    // Find the approval for this workflow instance
    const approval = pendingApprovals.find(
      (a: any) => a.workflow_instance_id === id
    )

    if (!approval) {
      return NextResponse.json(
        { error: 'No pending approval found for this workflow instance' },
        { status: 404 }
      )
    }

    // Submit the approval decision to the backend
    const approvalUrl = `${BACKEND_URL}/workflows/approvals/${approval.approval_id}/decision`
    
    // Build query parameters
    const queryParams = new URLSearchParams()
    queryParams.append('decision', decision)
    if (comments) {
      queryParams.append('comments', comments)
    }

    const approvalResponse = await fetch(`${approvalUrl}?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (!approvalResponse.ok) {
      const errorText = await approvalResponse.text()
      console.error('Backend approval API error:', approvalResponse.status, errorText)
      
      let errorMessage = 'Failed to submit approval decision'
      try {
        const errorData = JSON.parse(errorText)
        errorMessage = errorData.detail || errorMessage
      } catch {
        // Use default error message
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: approvalResponse.status }
      )
    }

    const approvalResult = await approvalResponse.json()

    // Return success response
    return NextResponse.json({
      success: true,
      decision,
      workflow_status: approvalResult.workflow_status,
      is_complete: approvalResult.is_complete,
      current_step: approvalResult.current_step,
      message: approvalResult.message || `Workflow ${decision} successfully`
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Approval submission API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to submit approval decision',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
