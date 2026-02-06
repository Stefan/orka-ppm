/**
 * Offline Changes Sync API Endpoint
 * Handles synchronization of changes made while offline
 * Requires Authorization: Bearer <token>. UserId in body/query must match token sub.
 */

import { NextRequest, NextResponse } from 'next/server'
import { enforceSyncAuth } from '@/lib/auth/verify-jwt'

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
    const change: OfflineChange = await request.json().catch(() => ({}))
    if (!change.userId || !change.deviceId || !change.type || !change.entity) {
      return NextResponse.json({
        error: 'Missing required fields: userId, deviceId, type, entity'
      }, { status: 400 })
    }

    const auth = await enforceSyncAuth(request.headers.get('Authorization'), change.userId)
    if (auth instanceof Response) {
      return NextResponse.json(
        (await auth.json().catch(() => ({ error: 'Unauthorized' }))) as { error: string },
        { status: auth.status }
      )
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
    const queryUserId = searchParams.get('userId')
    const auth = await enforceSyncAuth(request.headers.get('Authorization'), queryUserId)
    if (auth instanceof Response) {
      return NextResponse.json(
        (await auth.json().catch(() => ({ error: 'Unauthorized' }))) as { error: string },
        { status: auth.status }
      )
    }
    const userId = auth.userId

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