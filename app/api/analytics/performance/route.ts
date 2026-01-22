/**
 * Analytics Performance API Endpoint
 * Receives performance metrics from the frontend
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Log performance metrics (in production, you'd send to an analytics service)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Performance Analytics]', {
        url: body.url,
        webVitals: body.webVitals,
        longTasks: body.longTasks?.length || 0,
        timestamp: body.timestamp
      })
    }
    
    // In production, forward to backend or analytics service
    // For now, just acknowledge receipt
    return NextResponse.json({ 
      success: true, 
      message: 'Performance metrics received' 
    })
  } catch (error) {
    console.error('Error processing performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to process metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
