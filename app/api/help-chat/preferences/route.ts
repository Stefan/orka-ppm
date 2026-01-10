/**
 * Help Chat Preferences API Endpoint
 * Manages user preferences for help chat functionality
 */

import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for demo purposes
const userPreferences = new Map<string, any>()

function getDefaultPreferences() {
  return {
    language: 'en',
    proactiveTipsEnabled: true,
    contextualHelpEnabled: true,
    soundEnabled: false,
    theme: 'auto',
    responseStyle: 'detailed',
    autoTranslate: false,
    preferredTopics: [],
    dismissedTips: [],
    lastUpdated: new Date().toISOString()
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'anonymous'
    
    const preferences = userPreferences.get(userId) || getDefaultPreferences()
    
    return NextResponse.json(preferences, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Help chat preferences GET error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'anonymous'
    
    const currentPreferences = userPreferences.get(userId) || getDefaultPreferences()
    const updatedPreferences = {
      ...currentPreferences,
      ...body,
      lastUpdated: new Date().toISOString()
    }
    
    userPreferences.set(userId, updatedPreferences)
    
    return NextResponse.json({
      success: true,
      preferences: updatedPreferences
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Help chat preferences PUT error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}