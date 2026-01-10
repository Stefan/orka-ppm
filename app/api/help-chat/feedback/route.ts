/**
 * Help Chat Feedback API Endpoint
 * Handles user feedback for help responses
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { responseId, rating, feedback, sessionId } = body
    
    // Mock feedback processing
    console.log('Help chat feedback received:', {
      responseId,
      rating,
      feedback,
      sessionId,
      timestamp: new Date().toISOString()
    })
    
    const response = {
      success: true,
      feedbackId: `feedback-${Date.now()}`,
      message: 'Thank you for your feedback! This helps us improve our assistance.',
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Help chat feedback error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to submit feedback',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}