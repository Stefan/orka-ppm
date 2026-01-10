/**
 * Offline Changes Sync API Endpoint
 * Handles synchronization of changes made while offline
 */

import { NextRequest, NextResponse } from 'next/server'

interface OfflineChange {
  id: string
  userId: string
  deviceId: string
  type: 'create' | 'update' | 'delete'
  entity: string
  entityId: string
  data: any
  timestamp: Date
  synced: boolean
}

// In-memory storage for demo purposes
const offlineChanges = new Map<string, OfflineChange[]>()

export async function POST(request: NextRequest) {
  try {
    const change: OfflineChange = await request.json()
    
    if (!change.userId || !change.deviceId || !change.type || !change.entity) {
      return NextResponse.json({
        error: 'Missing required fields: userId, deviceId, type, entity'
      }, { status: 400 })
    }

    // Get existing changes for user or initialize empty array
    const userChanges = offlineChanges.get(change.userId) || []
    
    // Add the new change
    const newChange = {
      ...change,
      id: change.id || `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      synced: true // Mark as synced since we're processing it
    }
    
    userChanges.push(newChange)
    offlineChanges.set(change.userId, userChanges)
    
    return NextResponse.json({
      success: true,
      change: newChange,
      totalChanges: userChanges.length
    }, { status: 200 })
    
  } catch (error) {
    console.error('Offline changes sync error:', error)
    return NextResponse.json({
      error: 'Failed to sync offline changes',
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
    
    const userChanges = offlineChanges.get(userId) || []
    
    return NextResponse.json({
      changes: userChanges,
      totalChanges: userChanges.length
    }, { status: 200 })
    
  } catch (error) {
    console.error('Offline changes retrieval error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve offline changes',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}