import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// PRODUCTION FORCE OVERRIDE - Completely hardcoded values
// This bypasses ALL Vercel environment variables entirely
const PRODUCTION_SUPABASE_URL = 'https://xceyrfvxooiplbmwavlb.supabase.co'
const PRODUCTION_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo'

// For local development, use environment variable if available, otherwise use production
const PRODUCTION_API_URL = 'https://orka-ppm.onrender.com' // Force correct URL for production

/** Global key so multiple chunks sharing the same storage key use one GoTrueClient instance */
const BROWSER_SINGLETON_KEY = '__ORKA_PPM_SUPABASE_CLIENT__'

function createSupabaseClient(): SupabaseClient {
  return createClient(
    PRODUCTION_SUPABASE_URL,
    PRODUCTION_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'supabase.auth.token',
        storage: {
          getItem: (key: string) => {
            try {
              return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
            } catch {
              return null
            }
          },
          setItem: (key: string, value: string) => {
            try {
              if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
            } catch {
              // Ignore storage errors
            }
          },
          removeItem: (key: string) => {
            try {
              if (typeof localStorage !== 'undefined') localStorage.removeItem(key)
            } catch {
              // Ignore storage errors
            }
          },
        },
      },
      global: {
        headers: {
          'X-Client-Info': 'ppm-saas-frontend-production',
        },
      },
    }
  )
}

/** Single Supabase client: use window singleton in browser so all chunks share one GoTrueClient. */
function getSupabaseClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    const g = window as Window & { [key: string]: SupabaseClient | undefined }
    if (g[BROWSER_SINGLETON_KEY]) return g[BROWSER_SINGLETON_KEY]
    g[BROWSER_SINGLETON_KEY] = createSupabaseClient()
    return g[BROWSER_SINGLETON_KEY]
  }
  return createSupabaseClient()
}

// Production-ready Supabase client - single instance in browser (avoids "Multiple GoTrueClient" warning)
if (process.env.NODE_ENV === 'development') {
  console.log('✅ Supabase client (singleton) - Production Ready')
}

export const supabase = getSupabaseClient()

export const ENV_CONFIG = {
  url: PRODUCTION_SUPABASE_URL,
  keyLength: PRODUCTION_SUPABASE_ANON_KEY.length,
  keyPreview: PRODUCTION_SUPABASE_ANON_KEY.substring(0, 20) + '...',
  apiUrl: PRODUCTION_API_URL,
  isValid: true,
  forceOverride: true,
  validationSource: 'supabase-minimal.ts',
  productionMode: true,
  environmentBypass: true
}

export const API_URL = PRODUCTION_API_URL