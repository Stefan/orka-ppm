/**
 * API Services Barrel Export
 * Preferred entry for app code: client (fetch/Next.js proxy), supabase, auth.
 * For legacy generic helpers (get, post, put, del, getApiUrl) see lib/api.ts.
 * Supabase client is re-exported from supabase-minimal to ensure a single GoTrueClient instance in the browser.
 */

export * from './client'
export { supabase } from './supabase-minimal'
export { API_URL, ENV_CONFIG } from './supabase'
export * from './auth'