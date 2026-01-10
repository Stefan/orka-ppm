/**
 * User Preferences Sync API Endpoint
 * Handles user preferences synchronization across devices
 */

import { NextRequest, NextResponse } from 'next/server'

export interface UserPreferences {
  userId: string
  theme: 'light' | 'dark' | 'system'
  language: string
  dashboardLayout: {
    layout: 'grid' | 'masonry' | 'list'
    widgets: any[]
  }
  notifications: {
    email: boolean
    push: boolean
    desktop: boolean
  }
  accessibility: {
    highContrast: boolean
    largeText: boolean
    reducedMotion: boolean
  }
  lastUpdated: Date
}

// In-memory storage for demo purposes
const userPreferences = new Map<string, UserPreferences>()

function getDefaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    theme: 'system',
    language: 'en',
    dashboardLayout: {
      layout: 'grid',
      widgets: []
    },
    notifications: {
      email: true,
      push: true,
      desktop: true
    },
    accessibility: {
      highContrast: false,
      largeText: false,
      reducedMotion: false
    },
    lastUpdated: new Date()
  }
}

export async function PUT(request: NextRequest) {
  try {
    const preferences: UserPreferences = await request.json()
    
    if (!preferences.userId) {
      return NextResponse.json({
        error: 'Missing required field: userId'
      }, { status: 400 })
    }

    // Update preferences with current timestamp
    const updatedPreferences = {
      ...preferences,
      lastUpdated: new Date()
    }
    
    userPreferences.set(preferences.userId, updatedPreferences)
    
    return NextResponse.json({
      success: true,
      preferences: updatedPreferences
    }, { status: 200 })
    
  } catch (error) {
    console.error('Preferences update error:', error)
    return NextResponse.json({
      error: 'Failed to update preferences',
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