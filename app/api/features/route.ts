import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Default feature flags for development/fallback
const DEFAULT_FEATURE_FLAGS = [
  { name: 'costbook_phase1', enabled: true },
  { name: 'enhanced_pmr', enabled: true },
  { name: 'ai_resource_optimizer', enabled: true },
  { name: 'variance_analysis', enabled: true },
  { name: 'po_breakdown', enabled: true },
  { name: 'csv_import', enabled: true },
]

export async function GET() {
  // If no Supabase config, return default flags for development
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ flags: DEFAULT_FEATURE_FLAGS })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Query ALL feature flags from the database
    const { data, error } = await supabase
      .from('feature_flags')
      .select('name, status')

    if (error) {
      // If table doesn't exist or other error, use defaults
      console.warn('Feature flags query error, using defaults:', error.message)
      return NextResponse.json({ flags: DEFAULT_FEATURE_FLAGS })
    }

    // Map to expected format - flag is enabled only if status is 'enabled' or 'active'
    const dbFlags = (data ?? []).map(flag => ({
      name: flag.name,
      enabled: flag.status === 'enabled' || flag.status === 'active'
    }))

    // Create a map of flags from database
    const flagMap = new Map(dbFlags.map(f => [f.name, f.enabled]))

    // Build final flags list: DB values take precedence, defaults only for missing flags
    const flags: Array<{ name: string; enabled: boolean }> = []
    
    // First, add all DB flags
    for (const dbFlag of dbFlags) {
      flags.push(dbFlag)
    }
    
    // Then, add defaults only for flags not in DB
    for (const defaultFlag of DEFAULT_FEATURE_FLAGS) {
      if (!flagMap.has(defaultFlag.name)) {
        flags.push(defaultFlag)
      }
    }

    return NextResponse.json({ flags })
  } catch (err) {
    console.error('Feature flags error:', err)
    // Fallback to defaults on any error
    return NextResponse.json({ flags: DEFAULT_FEATURE_FLAGS })
  }
}
