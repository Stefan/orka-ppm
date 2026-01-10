/**
 * User Preferences Retrieval API Endpoint
 * Gets user preferences by userId
 */

import { NextRequest, NextResponse } from 'next/server'
import { userPreferences, getDefaultPreferences } from '../../../../lib/sync/storage'

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
    
    const preferences = userPreferences.get(userId)
    
    if (!preferences) {
      // Return default preferences if none exist
      const defaultPreferences = getDefaultPreferences(userId)
      return NextResponse.json(defaultPreferences, { status: 200 })
    }
    
    return NextResponse.json(preferences, { status: 200 })
    
  } catch (error) {
    console.error('Preferences retrieval error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}