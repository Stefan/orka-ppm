/**
 * Cross-Device Sync API Endpoint
 * Handles device registration and synchronization
 * Requires Authorization: Bearer <token>. UserId in body/query must match token sub.
 */

import { NextRequest, NextResponse } from 'next/server'
import { enforceSyncAuth } from '@/lib/auth/verify-jwt'

export interface DeviceInfo {
  id: string
  name: string
  type: 'desktop' | 'mobile' | 'tablet'
  platform: string
  lastSeen: Date
  isActive: boolean
}

// In-memory storage for demo purposes
const registeredDevices = new Map<string, DeviceInfo[]>()

interface DeviceRegistrationRequest {
  userId: string
  device: DeviceInfo
}

export async function POST(request: NextRequest) {
  try {
    const body: DeviceRegistrationRequest = await request.json().catch(() => ({}))
    if (!body.userId || !body.device) {
      return NextResponse.json({
        error: 'Missing required fields: userId and device'
      }, { status: 400 })
    }

    const auth = await enforceSyncAuth(request.headers.get('Authorization'), body.userId)
    if (auth instanceof Response) {
      return NextResponse.json(
        (await auth.json().catch(() => ({ error: 'Unauthorized' }))) as { error: string },
        { status: auth.status }
      )
    }

    // Get existing devices for user or initialize empty array
    const userDevices = registeredDevices.get(body.userId) || []
    
    // Check if device already exists
    const existingDeviceIndex = userDevices.findIndex(d => d.id === body.device.id)
    
    if (existingDeviceIndex >= 0) {
      // Update existing device
      userDevices[existingDeviceIndex] = {
        ...body.device,
        lastSeen: new Date()
      }
    } else {
      // Add new device
      userDevices.push({
        ...body.device,
        lastSeen: new Date()
      })
    }
    
    // Store updated devices list
    registeredDevices.set(body.userId, userDevices)
    
    return NextResponse.json({
      success: true,
      device: body.device,
      totalDevices: userDevices.length
    }, { status: 200 })
    
  } catch (error) {
    console.error('Device registration error:', error)
    return NextResponse.json({
      error: 'Failed to register device',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')
    if (!queryUserId?.trim()) {
      return NextResponse.json({ error: 'Missing required parameter: userId' }, { status: 400 })
    }
    const auth = await enforceSyncAuth(request.headers.get('Authorization'), queryUserId)
    if (auth instanceof Response) {
      return NextResponse.json(
        (await auth.json().catch(() => ({ error: 'Unauthorized' }))) as { error: string },
        { status: auth.status }
      )
    }
    const userId = auth.userId

    const userDevices = registeredDevices.get(userId) || []
    
    return NextResponse.json({
      devices: userDevices,
      totalDevices: userDevices.length
    }, { status: 200 })
    
  } catch (error) {
    console.error('Device retrieval error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve devices',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}