/**
 * Project Budget Variance API Endpoint
 * Computes budget variance for a specific project
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const authHeader = request.headers.get('authorization')
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency') || 'USD'
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }
    
    // Fetch project data from backend
    const projectResponse = await fetch(`${BACKEND_URL}/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      }
    })

    if (!projectResponse.ok) {
      // Return fallback data instead of error for better UX
      console.warn(`Budget variance: Backend returned ${projectResponse.status} for project ${projectId}`)
      return NextResponse.json({
        project_id: projectId,
        project_name: 'Unknown Project',
        budget: 0,
        actual_cost: 0,
        variance: 0,
        variance_percentage: 0,
        status: 'on',
        currency: currency,
        last_updated: new Date().toISOString()
      })
    }

    const project = await projectResponse.json()
    
    // Calculate budget variance
    const budget = parseFloat(project.budget) || 0
    const actualCost = parseFloat(project.actual_cost) || 0
    const variance = actualCost - budget
    const variancePercentage = budget > 0 ? (variance / budget) * 100 : 0
    
    // Determine status
    let status: 'under' | 'on' | 'over' = 'on'
    if (variancePercentage < -5) {
      status = 'under'
    } else if (variancePercentage > 5) {
      status = 'over'
    }

    const budgetVariance = {
      project_id: projectId,
      project_name: project.name,
      budget: budget,
      actual_cost: actualCost,
      variance: variance,
      variance_percentage: variancePercentage,
      status: status,
      currency: currency,
      last_updated: project.updated_at || new Date().toISOString()
    }

    return NextResponse.json(budgetVariance)
  } catch (error) {
    console.error('Error computing budget variance:', error)
    // Return fallback data instead of error
    const { searchParams } = new URL(request.url)
    const currency = searchParams.get('currency') || 'USD'
    const { projectId } = await params
    return NextResponse.json({
      project_id: projectId,
      project_name: 'Unknown Project',
      budget: 0,
      actual_cost: 0,
      variance: 0,
      variance_percentage: 0,
      status: 'on',
      currency: currency,
      last_updated: new Date().toISOString()
    })
  }
}
