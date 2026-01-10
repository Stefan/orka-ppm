/**
 * User Devices Retrieval API Endpoint
 * Gets all registered devices for a user
 */

import { NextRequest, NextResponse } from 'next/server'

interface DeviceInfo {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  platform: string
  lastSeen: Date
  isActive: boolean
}

// In-memory storage for demo purposes
// This should be shared with the POST endpoint in a real implementation
const registeredDevices = new Map<string, DeviceInfo[]>()

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
    
    const userDevices = registeredDevices.get(userId) || []
    
    return NextResponse.json(userDevices, { status: 200 })
    
  } catch (error) {
    console.error('Device retrieval error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve devices',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}