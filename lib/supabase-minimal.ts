import { createClient } from '@supabase/supabase-js'

// PRODUCTION FORCE OVERRIDE - Completely hardcoded values
// This bypasses ALL Vercel environment variables entirely
const PRODUCTION_SUPABASE_URL = 'https://xceyrfvxooiplbmwavlb.supabase.co'
const PRODUCTION_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZXlyZnZ4b29pcGxibXdhdmxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Mjg3ODEsImV4cCI6MjA4MjQwNDc4MX0.jIyJlwx2g9xn8OTSaLum6H8BKqknyxB8gYxgEKdfgqo'

// For local development, use environment variable if available, otherwise use production
const PRODUCTION_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://orka-ppm.onrender.com'

console.log('✅ Creating Supabase client with minimal config - Production Ready')
console.log('🔧 Force Override Active: Bypassing ALL environment variables')
console.log('🌐 Using hardcoded production values for stability')

// Create client with hardcoded values - NO environment variable dependency
export const supabase = createClient(
  PRODUCTION_SUPABASE_URL,
  PRODUCTION_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Handle refresh token errors gracefully
      storageKey: 'ppm-auth-token',
      storage: {
        getItem: (key: string) => {
          try {
            return localStorage.getItem(key)
          } catch {
            return null
          }
        },
        setItem: (key: string, value: string) => {
          try {
            localStorage.setItem(key, value)
          } catch {
            // Ignore storage errors
          }
        },
        removeItem: (key: string) => {
          try {
            localStorage.removeItem(key)
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

console.log('✅ Supabase client created successfully (minimal) - Ready for production')
console.log('🎯 Configuration: URL length:', PRODUCTION_SUPABASE_URL.length, 'Key length:', PRODUCTION_SUPABASE_ANON_KEY.length)
console.log('🔗 API URL:', PRODUCTION_API_URL)
console.log('🚀 Production mode: Environment variables completely bypassed')