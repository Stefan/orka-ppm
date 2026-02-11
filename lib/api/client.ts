/**
 * Next.js API client: getApiUrl, fetch with auth.
 * Use this (or lib/api/supabase, lib/api/auth) for app requests.
 * Legacy generic helpers are in lib/api.ts.
 */

// Browser API type declarations
declare global {
  interface RequestInit {
    method?: string
    headers?: HeadersInit
    body?: BodyInit | null
    mode?: RequestMode
    credentials?: RequestCredentials
    cache?: RequestCache
    redirect?: RequestRedirect
    referrer?: string
    referrerPolicy?: ReferrerPolicy
    integrity?: string
    keepalive?: boolean
    signal?: AbortSignal | null
  }
}

// API configuration with fallbacks - Use Next.js API proxy
export const API_CONFIG = {
  baseURL: '/api', // Use Next.js API routes as proxy
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
} as const

// API URL builder with validation and fallback
export function getApiUrl(endpoint: string): string {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  // Remove /api prefix if present since we'll add it
  const cleanEndpoint = normalizedEndpoint.startsWith('/api/') ? normalizedEndpoint.slice(4) : normalizedEndpoint
  return `/api${cleanEndpoint}`
}

// Fetch wrapper with error handling
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint)
  
  console.log(`🌐 API Request: ${endpoint} -> ${url}`)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...options.headers,
      },
    })
    
    console.log(`✅ Response: ${endpoint} - ${response.status}`)
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    return data as T
  } catch (error: unknown) {
    console.error(`❌ API request error for ${endpoint}:`, error)
    throw error instanceof Error ? error : new Error('Unknown API error')
  }
}