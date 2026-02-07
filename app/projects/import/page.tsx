'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect to unified Data Import page under Management.
 * Keeps old links (/projects/import) working.
 */
export default function ProjectImportRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/import')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-[200px] text-gray-600 dark:text-slate-400">
      Redirecting to Data Import…
    </div>
  )
}
