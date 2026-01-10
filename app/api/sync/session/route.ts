/**
 * Session State Sync API Endpoint
 * Handles session state synchronization across devices
 */

import { NextRequest, NextResponse } from 'next/server'

export interface SessionState {
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
const sessionStates = new Map<string, SessionState>()

function getDefaultSessionState(userId: string): SessionState {
  return {
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
}

export async function PUT(request: NextRequest) {
  try {
    const sessionState: SessionState = await request.json()
    
    if (!sessionState.userId || !sessionState.deviceId) {
      return NextResponse.json({
        error: 'Missing required fields: userId and deviceId'
      }, { status: 400 })
    }

    // Update session state with current timestamp
    const updatedSessionState = {
      ...sessionState,
      lastActivity: new Date()
    }
    
    // Use userId as key for latest session
    sessionStates.set(sessionState.userId, updatedSessionState)
    
    return NextResponse.json({
      success: true,
      sessionState: updatedSessionState
    }, { status: 200 })
    
  } catch (error) {
    console.error('Session state update error:', error)
    return NextResponse.json({
      error: 'Failed to update session state',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({
        error: 'Missing required parameter: userId'
      }, { status: 400 })
    }
    
    const sessionState = sessionStates.get(userId)
    
    if (!sessionState) {
      // Return empty session state if none exists
      const defaultSessionState = getDefaultSessionState(userId)
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