// Environment variables validation and fallbacks
function cleanEnvVar(value: string | undefined): string {
  if (!value) return '';
  // Remove quotes and trim whitespace
  return value.replace(/^["']|["']$/g, '').trim();
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  NEXT_PUBLIC_API_URL: cleanEnvVar(process.env.NEXT_PUBLIC_API_URL) || 'http://localhost:8000',
} as const;

// Runtime validation
export function validateEnv() {
  const requiredEnvs = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ] as const;

  const missing = requiredEnvs.filter(key => !env[key]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    if (typeof window === 'undefined') {
      // Server-side: throw error
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    } else {
      // Client-side: log warning but don't crash
      console.warn('Some environment variables are missing. App may not work correctly.');
    }
  }

  // Validate URL formats
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    } catch (error) {
      console.error('Invalid NEXT_PUBLIC_SUPABASE_URL format:', env.NEXT_PUBLIC_SUPABASE_URL);
      throw new Error(`Invalid NEXT_PUBLIC_SUPABASE_URL format: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
    }
  }

  if (env.NEXT_PUBLIC_API_URL) {
    try {
      new URL(env.NEXT_PUBLIC_API_URL);
    } catch (error) {
      console.error('Invalid NEXT_PUBLIC_API_URL format:', env.NEXT_PUBLIC_API_URL);
      throw new Error(`Invalid NEXT_PUBLIC_API_URL format: ${env.NEXT_PUBLIC_API_URL}`);
    }
  }
  
  return env;
}

// Validate on module load
validateEnv();