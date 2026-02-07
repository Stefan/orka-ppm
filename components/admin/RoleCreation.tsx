'use client'

import React, { useState, useCallback } from 'react'
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
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Loader2, AlertCircle, Info, Shield } from 'lucide-react'
import { PermissionSelector } from './PermissionSelector'
import type { Permission } from '@/types/rbac'

/**
 * Custom role data
 */
interface CustomRoleData {
  name: string
  description: string
  permissions: Permission[]
}

interface RoleCreationProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  existingRole?: {
    id: string
    name: string
    description: string
    permissions: Permission[]
  }
}

/**
 * RoleCreation Component
 * 
 * Component for creating and editing custom roles with permission selection.
 * Supports:
 * - Creating new custom roles
 * - Editing existing custom roles
 * - Permission validation
 * - Invalid configuration prevention
 * 
 * Requirements: 4.2, 4.3 - Custom role creation with permission validation
 */
export function RoleCreation({
  open,
  onClose,
  onSuccess,
  existingRole,
}: RoleCreationProps) {
  const { session } = useAuth()
  const [roleData, setRoleData] = useState<CustomRoleData>({
    name: existingRole?.name || '',
    description: existingRole?.description || '',
    permissions: existingRole?.permissions || [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  /**
   * Validate role configuration
   */
  const validateRole = useCallback((data: CustomRoleData): string[] => {
    const errors: string[] = []

    // Validate name
    if (!data.name.trim()) {
      errors.push('Role name is required')
    } else if (data.name.length < 3) {
      errors.push('Role name must be at least 3 characters')
    } else if (data.name.length > 50) {
      errors.push('Role name must not exceed 50 characters')
    } else if (!/^[a-z][a-z0-9_]*$/.test(data.name)) {
      errors.push('Role name must start with a letter and contain only lowercase letters, numbers, and underscores')
    }

    // Validate description
    if (!data.description.trim()) {
      errors.push('Role description is required')
    } else if (data.description.length < 10) {
      errors.push('Role description must be at least 10 characters')
    } else if (data.description.length > 500) {
      errors.push('Role description must not exceed 500 characters')
    }

    // Validate permissions
    if (data.permissions.length === 0) {
      errors.push('At least one permission must be selected')
    }

    // Check for invalid permission combinations
    const hasSystemAdmin = data.permissions.includes('system_admin')
    const hasRoleManage = data.permissions.includes('role_manage')
    const hasUserManage = data.permissions.includes('user_manage')

    if (hasSystemAdmin && data.permissions.length > 1) {
      errors.push('system_admin permission should not be combined with other permissions (it grants full access)')
    }

    if (hasRoleManage && !hasUserManage) {
      errors.push('role_manage permission requires user_manage permission')
    }

    // Check for conflicting read/write permissions
    const hasFinancialWrite = data.permissions.some(p => 
      p === 'financial_create' || p === 'financial_update' || p === 'financial_delete'
    )
    const hasFinancialRead = data.permissions.includes('financial_read')

    if (hasFinancialWrite && !hasFinancialRead) {
      errors.push('Financial write permissions require financial_read permission')
    }

    // Similar checks for other permission categories
    const hasProjectWrite = data.permissions.some(p => 
      p === 'project_create' || p === 'project_update' || p === 'project_delete'
    )
    const hasProjectRead = data.permissions.includes('project_read')

    if (hasProjectWrite && !hasProjectRead) {
      errors.push('Project write permissions require project_read permission')
    }

    const hasPortfolioWrite = data.permissions.some(p => 
      p === 'portfolio_create' || p === 'portfolio_update' || p === 'portfolio_delete'
    )
    const hasPortfolioRead = data.permissions.includes('portfolio_read')

    if (hasPortfolioWrite && !hasPortfolioRead) {
      errors.push('Portfolio write permissions require portfolio_read permission')
    }

    return errors
  }, [])

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate role configuration
    const errors = validateRole(roleData)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors([])

    if (!session?.access_token) {
      setError('Not authenticated')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const endpoint = existingRole
        ? getApiUrl(`/api/admin/roles/${existingRole.id}`)
        : getApiUrl('/api/admin/roles')
      const method = existingRole ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to ${existingRole ? 'update' : 'create'} role: ${response.status}`)
      }

      // Success - call onSuccess callback
      onSuccess()
    } catch (err) {
      console.error(`Error ${existingRole ? 'updating' : 'creating'} role:`, err)
      setError(err instanceof Error ? err.message : `Failed to ${existingRole ? 'update' : 'create'} role`)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle permission selection change
   */
  const handlePermissionsChange = useCallback((permissions: Permission[]) => {
    setRoleData(prev => ({ ...prev, permissions }))
    // Clear validation errors when permissions change
    setValidationErrors([])
  }, [])

  /**
   * Handle role name change
   */
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setRoleData(prev => ({ ...prev, name: value }))
    setValidationErrors([])
  }, [])

  /**
   * Handle description change
   */
  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRoleData(prev => ({ ...prev, description: e.target.value }))
    setValidationErrors([])
  }, [])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {existingRole ? 'Edit Custom Role' : 'Create Custom Role'}
          </DialogTitle>
          <DialogDescription>
            {existingRole
              ? 'Update the role configuration and permissions'
              : 'Define a new custom role with specific permissions'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Role Name */}
          <div className="space-y-2">
            <Label htmlFor="role-name">
              Role Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="role-name"
              type="text"
              placeholder="e.g., custom_manager"
              value={roleData.name}
              onChange={handleNameChange}
              disabled={loading || !!existingRole}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, and underscores only. Must start with a letter.
            </p>
          </div>

          {/* Role Description */}
          <div className="space-y-2">
            <Label htmlFor="role-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="role-description"
              placeholder="Describe the purpose and scope of this role..."
              value={roleData.description}
              onChange={handleDescriptionChange}
              disabled={loading}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {roleData.description.length}/500 characters
            </p>
          </div>

          {/* Permission Selection */}
          <div className="space-y-2">
            <Label>
              Permissions <span className="text-destructive">*</span>
            </Label>
            <PermissionSelector
              selectedPermissions={roleData.permissions}
              onChange={handlePermissionsChange}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {roleData.permissions.length} permission(s) selected
            </p>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Configuration Issues:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* General Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Info Alert */}
          {!validationErrors.length && !error && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Custom roles allow you to create specific permission sets for your organization's needs.
                Ensure you select appropriate permissions to maintain security.
              </AlertDescription>
            </Alert>
          )}

          {/* Dialog Footer */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {existingRole ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                existingRole ? 'Update Role' : 'Create Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default RoleCreation
