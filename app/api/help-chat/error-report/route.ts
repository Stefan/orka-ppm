/**
 * Help Chat Error Reporting API Endpoint
 * Handles error reporting for help chat functionality
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { error, context, timestamp } = body
    
    // Log error for monitoring (in production, this would go to a logging service)
    console.error('Help Chat Error Report:', {
      error: {
        message: error?.message,
        stack: error?.stack,
        code: error?.code
      },
      context,
      timestamp,
      reportedAt: new Date().toISOString()
    })
    
    return NextResponse.json({
      success: true,
      reportId: `error-${Date.now()}`,
      message: 'Error report received successfully',
      timestamp: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (reportError) {
    console.error('Failed to process error report:', reportError)
    return NextResponse.json(
      { 
        error: 'Failed to process error report',
        message: reportError instanceof Error ? reportError.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}