import type { ReactNode } from 'react'

/**
 * Settings segment layout.
 * Force dynamic rendering so the build does not require Supabase env vars
 * when prerendering (settings page dependencies pull in env).
 */
export const dynamic = 'force-dynamic'

export default function SettingsLayout({
  children,
}: {
  children: ReactNode
}) {
  return <>{children}</>
}
