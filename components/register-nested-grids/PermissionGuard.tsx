'use client'

/**
 * Permission Guard - View/Edit permission check
 * Requirements: 6.1, 6.2, 6.3
 */

import React, { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { checkPermission, getAlternative, type PermissionAction, type PermissionAlternative } from '@/lib/register-nested-grids/permissions'

interface PermissionGuardProps {
  resourceId: string
  action: PermissionAction
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function PermissionGuard({
  resourceId,
  action,
  children,
  fallback,
}: PermissionGuardProps) {
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [alternative, setAlternative] = useState<PermissionAlternative | null>(null)

  useEffect(() => {
    checkPermission(resourceId, action).then(setAllowed)
    getAlternative(resourceId, action).then(setAlternative)
  }, [resourceId, action])

  if (allowed === null) return null
  if (allowed) return <>{children}</>

  if (fallback) return <>{fallback}</>

  return (
    <div
      className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800"
      data-testid="permission-guard-denied"
    >
      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
      <span>{alternative?.message ?? 'You do not have permission to view this content.'}</span>
    </div>
  )
}
