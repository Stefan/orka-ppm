import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Validate environment variables
if (!env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

// Additional validation for URL format
try {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
  if (!url.hostname.includes('supabase.co')) {
    throw new Error('Invalid Supabase URL format')
  }
} catch (error) {
  throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL format: ${env.NEXT_PUBLIC_SUPABASE_URL}`)
}

// Validate API key format (should be a JWT)
if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('.')) {
  throw new Error('Invalid Supabase API key format - should be a JWT token')
}

console.log('Creating Supabase client with URL:', env.NEXT_PUBLIC_SUPABASE_URL)

export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'ppm-saas-frontend',
      },
    },
  }
)