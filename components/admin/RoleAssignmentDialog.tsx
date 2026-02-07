'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { getApiUrl } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Info } from 'lucide-react'

/**
 * Available role information
 */
interface RoleInfo {
  role: string
  permissions: string[]
  description: string
}

/**
 * Scope type for role assignments
 */
type ScopeType = 'global' | 'organization' | 'portfolio' | 'project'

/**
 * Scope option for selection
 */
interface ScopeOption {
  id: string
  name: string
  type: ScopeType
}

/**
 * User information for role assignment
 */
interface UserInfo {
  id: string
  email: string
  full_name?: string
}

interface RoleAssignmentDialogProps {
  user: UserInfo | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

/**
 * RoleAssignmentDialog Component
 * 
 * Dialog for assigning roles to users with scope selection.
 * Supports:
 * - Global role assignments
 * - Organization-scoped assignments
 * - Portfolio-scoped assignments
 * - Project-scoped assignments
 * 
 * Requirements: 4.1 - Role assignment interface with scope selection
 */
export function RoleAssignmentDialog({
  user,
  open,
  onClose,
  onSuccess,
}: RoleAssignmentDialogProps) {
  const { session } = useAuth()
  const [roles, setRoles] = useState<RoleInfo[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [scopeType, setScopeType] = useState<ScopeType>('global')
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([])
  const [selectedScopeId, setSelectedScopeId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingScopes, setLoadingScopes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch available roles
   */
  const fetchRoles = useCallback(async () => {
    if (!session?.access_token) return

    try {
      const response = await fetch(getApiUrl('/api/admin/roles'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.status}`)
      }

      const data = await response.json()
      setRoles(data)
    } catch (err) {
      console.error('Error fetching roles:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch roles')
    }
  }, [session?.access_token])

  /**
   * Fetch scope options based on selected scope type
   */
  const fetchScopeOptions = useCallback(async (type: ScopeType) => {
    if (type === 'global' || !session?.access_token) {
      setScopeOptions([])
      setSelectedScopeId('')
      return
    }

    try {
      setLoadingScopes(true)
      let endpoint = ''
      switch (type) {
        case 'organization':
          endpoint = '/api/admin/organizations'
          break
        case 'portfolio':
          endpoint = '/api/portfolios'
          break
        case 'project':
          endpoint = '/api/projects'
          break
      }

      const response = await fetch(getApiUrl(endpoint), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch ${type} options: ${response.status}`)
      }

      const data = await response.json()
      const options: ScopeOption[] = data.map((item: any) => ({
        id: item.id,
        name: item.name || item.title || item.email,
        type,
      }))

      setScopeOptions(options)
      setSelectedScopeId('')
    } catch (err) {
      console.error(`Error fetching ${type} options:`, err)
      setError(err instanceof Error ? err.message : `Failed to fetch ${type} options`)
    } finally {
      setLoadingScopes(false)
    }
  }, [session?.access_token])

  /**
   * Load roles on mount
   */
  useEffect(() => {
    if (open) {
      fetchRoles()
    }
  }, [open, fetchRoles])

  /**
   * Load scope options when scope type changes
   */
  useEffect(() => {
    if (open && scopeType !== 'global') {
      fetchScopeOptions(scopeType)
    }
  }, [open, scopeType, fetchScopeOptions])

  /**
   * Handle role assignment submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !selectedRole) {
      setError('Please select a role')
      return
    }

    if (scopeType !== 'global' && !selectedScopeId) {
      setError(`Please select a ${scopeType}`)
      return
    }

    if (!session?.access_token) {
      setError('Not authenticated')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const payload: any = {
        user_id: user.id,
        role_id: selectedRole,
      }

      // Add scope information if not global
      if (scopeType !== 'global') {
        payload.scope_type = scopeType
        payload.scope_id = selectedScopeId
      }

      const response = await fetch(getApiUrl('/api/admin/role-assignments'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to assign role: ${response.status}`)
      }

      // Success - call onSuccess callback
      onSuccess()
    } catch (err) {
      console.error('Error assigning role:', err)
      setError(err instanceof Error ? err.message : 'Failed to assign role')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Get selected role information
   */
  const selectedRoleInfo = roles.find(r => r.role === selectedRole)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Assign Role</DialogTitle>
          <DialogDescription>
            {user ? (
              <>
                Assign a role to <strong>{user.full_name || user.email}</strong>
              </>
            ) : (
              'Select a user and role to assign'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => (
                  <SelectItem key={role.role} value={role.role}>
                    <div className="flex flex-col">
                      <span className="font-medium">{role.role}</span>
                      <span className="text-xs text-muted-foreground">
                        {role.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Role Permissions Info */}
            {selectedRoleInfo && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="text-sm">
                    <strong>Permissions:</strong> {selectedRoleInfo.permissions.length} permissions
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selectedRoleInfo.permissions.slice(0, 5).join(', ')}
                      {selectedRoleInfo.permissions.length > 5 && ` +${selectedRoleInfo.permissions.length - 5} more`}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Scope Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="scope-type">Scope</Label>
            <Select value={scopeType} onValueChange={(value) => setScopeType(value as ScopeType)}>
              <SelectTrigger id="scope-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <div className="flex flex-col">
                    <span className="font-medium">Global</span>
                    <span className="text-xs text-muted-foreground">
                      Access across all resources
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="organization">
                  <div className="flex flex-col">
                    <span className="font-medium">Organization</span>
                    <span className="text-xs text-muted-foreground">
                      Limited to specific organization
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="portfolio">
                  <div className="flex flex-col">
                    <span className="font-medium">Portfolio</span>
                    <span className="text-xs text-muted-foreground">
                      Limited to specific portfolio
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="project">
                  <div className="flex flex-col">
                    <span className="font-medium">Project</span>
                    <span className="text-xs text-muted-foreground">
                      Limited to specific project
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scope Selection (if not global) */}
          {scopeType !== 'global' && (
            <div className="space-y-2">
              <Label htmlFor="scope-id">
                Select {scopeType.charAt(0).toUpperCase() + scopeType.slice(1)}
              </Label>
              {loadingScopes ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading {scopeType} options...
                  </span>
                </div>
              ) : (
                <Select value={selectedScopeId} onValueChange={setSelectedScopeId}>
                  <SelectTrigger id="scope-id">
                    <SelectValue placeholder={`Select a ${scopeType}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map(option => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Dialog Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedRole}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default RoleAssignmentDialog
