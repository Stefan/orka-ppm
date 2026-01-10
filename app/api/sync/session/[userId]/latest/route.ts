/**
 * Latest Session State Retrieval API Endpoint
 * Gets the latest session state for a user
 */

import { NextRequest, NextResponse } from 'next/server'

interface SessionState {
  userId: string
  deviceId: string
  currentPage: string
  scrollPosition: { [key: string]: number }
  formData: { [key: string]: any }
  openModals: string[]
  selectedItems: { [key: string]: string[] }
  filters: { [key: string]: any }
  searchQueries: { [key: string]: string }
  lastActivity: Date
  sessionId: string
}

// In-memory storage for demo purposes
// This should be shared with the PUT endpoint in a real implementation
const sessionStates = new Map<string, SessionState>()

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    
    if (!userId) {
      return NextResponse.json({
        error: 'Missing required parameter: userId'
      }, { status: 400 })
    }
    
    const sessionState = sessionStates.get(userId)
    
    if (!sessionState) {
      // Return empty session state if none exists
      const defaultSessionState: SessionState = {
        userId,
        deviceId: '',
        currentPage: '/',
        scrollPosition: {},
        formData: {},
        openModals: [],
        selectedItems: {},
        filters: {},
        searchQueries: {},
        lastActivity: new Date(),
        sessionId: `session_${Date.now()}`
      }
      
      return NextResponse.json(defaultSessionState, { status: 200 })
    }
    
    return NextResponse.json(sessionState, { status: 200 })
    
  } catch (error) {
    console.error('Session state retrieval error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve session state',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}