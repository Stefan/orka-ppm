/**
 * Minimal Supabase Configuration
 * Re-exports the single Supabase client from ./supabase to avoid multiple GoTrueClient instances.
 * Provides ENV_CONFIG getters, Database types, and auth utility functions.
 */

import { supabase } from './supabase'
export { supabase }

// Environment configuration - use getters for runtime evaluation
export const ENV_CONFIG = {
  get supabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  },
  get supabaseAnonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  },
  get isDevelopment() {
    return process.env.NODE_ENV === 'development'
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  },
}

// Validate required environment variables at runtime
const getValidConfig = () => {
  return !!(ENV_CONFIG.supabaseUrl && ENV_CONFIG.supabaseAnonKey &&
    ENV_CONFIG.supabaseUrl !== 'https://placeholder.supabase.co' &&
    ENV_CONFIG.supabaseAnonKey !== 'placeholder-anon-key')
}

// Only warn in browser context where env vars should definitely be available
if (typeof window !== 'undefined' && !getValidConfig()) {
  console.warn('⚠️ Missing or invalid Supabase environment variables. Authentication will not work.')
  console.warn('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file')
  console.warn('Current values:', {
    url: ENV_CONFIG.supabaseUrl || '(empty)',
    keyLength: ENV_CONFIG.supabaseAnonKey?.length || 0
  })
}

// Database types (basic)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string
          updated_at?: string
        }
      }
    }
  }
}

// Utility functions
export const getUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error getting user:', error)
    return null
  }
  return user
}

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Error getting session:', error)
    return null
  }
  return session
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
    throw error
  }
}

// Export default client
export default supabase
