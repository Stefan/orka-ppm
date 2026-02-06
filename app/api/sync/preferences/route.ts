/**
 * User Preferences Sync API Endpoint
 * Handles user preferences synchronization across devices
 * Persists to Supabase user_profiles.preferences (JSONB)
 * Requires Authorization: Bearer <token>. UserId in body/query must match token sub (IDOR protection).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { enforceSyncAuth } from '@/lib/auth/verify-jwt'

/** Lazy Supabase client so build (no env) does not throw "supabaseUrl is required" at module load */
function getSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// Default preferences structure (matches cross-device-sync.ts)
function getDefaultPreferences(userId: string) {
  return {
    userId,
    theme: 'auto',
    language: 'en',
    timezone: 'UTC',
    currency: 'USD',
    dashboardLayout: {
      widgets: [],
      layout: 'grid'
    },
    dashboardKPIs: {
      successRateMethod: 'health',
      budgetMethod: 'spent',
      resourceMethod: 'auto',
      resourceFixedValue: 85
    },
    navigationPreferences: {
      collapsedSections: [],
      pinnedItems: [],
      recentItems: []
    },
    aiSettings: {
      enableSuggestions: true,
      enablePredictiveText: true,
      enableAutoOptimization: false
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
    devicePreferences: {},
    version: 1,
    lastModified: new Date().toISOString(),
    modifiedBy: 'server'
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const preferences = await request.json().catch(() => ({}))
    const auth = await enforceSyncAuth(authHeader, preferences.userId ?? null)
    if (auth instanceof Response) {
      return NextResponse.json(
        (await auth.json().catch(() => ({ error: 'Unauthorized' }))) as { error: string },
        { status: auth.status }
      )
    }
    const userId = auth.userId

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Preferences sync not configured' }, { status: 503 })
    }

    if (!preferences.userId) {
      return NextResponse.json({
        error: 'Missing required field: userId'
      }, { status: 400 })
    }
    if (preferences.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Merge with current timestamp
    const updatedPreferences = {
      ...preferences,
      lastModified: new Date().toISOString(),
      version: (preferences.version || 0) + 1
    }

    // Check if user_profiles entry exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('user_id, preferences')
      .eq('user_id', preferences.userId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (which is fine for new users)
      console.error('Error fetching existing profile:', fetchError)
    }

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          preferences: updatedPreferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', preferences.userId)

      if (updateError) {
        console.error('Error updating preferences:', updateError)
        return NextResponse.json({
          error: 'Failed to update preferences',
          message: updateError.message
        }, { status: 500 })
      }
    } else {
      // Insert new profile with preferences
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: preferences.userId,
          preferences: updatedPreferences,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error inserting preferences:', insertError)
        return NextResponse.json({
          error: 'Failed to save preferences',
          message: insertError.message
        }, { status: 500 })
      }
    }
    
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
    const authHeader = request.headers.get('Authorization')
    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')
    const auth = await enforceSyncAuth(authHeader, queryUserId)
    if (auth instanceof Response) {
      return NextResponse.json(
        (await auth.json().catch(() => ({ error: 'Unauthorized' }))) as { error: string },
        { status: auth.status }
      )
    }
    const userId = auth.userId

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ error: 'Preferences sync not configured' }, { status: 503 })
    }

    // Fetch preferences from Supabase
    const { data, error } = await supabase
      .from('user_profiles')
      .select('preferences')
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found, return defaults
        const defaultPreferences = getDefaultPreferences(userId)
        return NextResponse.json(defaultPreferences, { 
          status: 200,
          headers: { 'X-Data-Source': 'defaults' }
        })
      }
      
      console.error('Preferences retrieval error:', error)
      return NextResponse.json({
        error: 'Failed to retrieve preferences',
        message: error.message
      }, { status: 500 })
    }

    if (!data?.preferences) {
      // Profile exists but no preferences, return defaults
      const defaultPreferences = getDefaultPreferences(userId)
      return NextResponse.json(defaultPreferences, { 
        status: 200,
        headers: { 'X-Data-Source': 'defaults' }
      })
    }

    // Merge stored preferences with defaults (ensures new fields are present)
    const defaults = getDefaultPreferences(userId)
    const mergedPreferences = {
      ...defaults,
      ...data.preferences,
      // Ensure nested objects are properly merged
      dashboardLayout: {
        ...defaults.dashboardLayout,
        ...(data.preferences.dashboardLayout || {})
      },
      dashboardKPIs: {
        ...defaults.dashboardKPIs,
        ...(data.preferences.dashboardKPIs || {})
      },
      aiSettings: {
        ...defaults.aiSettings,
        ...(data.preferences.aiSettings || {})
      },
      navigationPreferences: {
        ...defaults.navigationPreferences,
        ...(data.preferences.navigationPreferences || {})
      }
    }
    
    return NextResponse.json(mergedPreferences, { 
      status: 200,
      headers: { 'X-Data-Source': 'database' }
    })
    
  } catch (error) {
    console.error('Preferences retrieval error:', error)
    return NextResponse.json({
      error: 'Failed to retrieve preferences',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
