'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Loader2, Search, Plus, Edit, Trash2, Shield, AlertCircle, Users } from 'lucide-react'
import { RoleCreation } from './RoleCreation'
import type { Permission } from '@/types/rbac'

/**
 * Custom role information
 */
interface CustomRole {
  id: string
  name: string
  description: string
  permissions: Permission[]
  is_custom: boolean
  assigned_users_count: number
  created_at: string
  updated_at?: string
}

/**
 * RoleManagement Component
 * 
 * Comprehensive interface for managing custom roles.
 * Features:
 * - View all roles (system and custom)
 * - Create new custom roles
 * - Edit existing custom roles
 * - Delete custom roles (with safety checks)
 * - View role usage statistics
 * - Search and filter roles
 * 
 * Requirements: 4.2, 4.3 - Custom role creation and management
 */
export function RoleManagement() {
  const { session } = useAuth()
  const [roles, setRoles] = useState<CustomRole[]>([])
  const [filteredRoles, setFilteredRoles] = useState<CustomRole[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null)

  /**
   * Fetch all roles
   */
  const fetchRoles = useCallback(async () => {
    if (!session?.access_token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/admin/roles/all`, {
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
      setFilteredRoles(data)
    } catch (err) {
      console.error('Error fetching roles:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch roles')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  /**
   * Filter roles based on search query
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRoles(roles)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = roles.filter(role =>
      role.name.toLowerCase().includes(query) ||
      role.description.toLowerCase().includes(query) ||
      role.permissions.some(p => p.toLowerCase().includes(query))
    )
    setFilteredRoles(filtered)
  }, [searchQuery, roles])

  /**
   * Load roles on mount
   */
  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  /**
   * Handle role creation success
   */
  const handleRoleCreated = useCallback(() => {
    setShowCreateDialog(false)
    fetchRoles()
  }, [fetchRoles])

  /**
   * Handle role edit success
   */
  const handleRoleUpdated = useCallback(() => {
    setEditingRole(null)
    fetchRoles()
  }, [fetchRoles])

  /**
   * Handle role deletion
   */
  const handleDeleteRole = useCallback(async (role: CustomRole) => {
    if (!session?.access_token) {
      setError('Not authenticated')
      return
    }

    // Prevent deletion of system roles
    if (!role.is_custom) {
      setError('Cannot delete system roles')
      return
    }

    // Warn if role has assigned users
    if (role.assigned_users_count > 0) {
      const confirmed = confirm(
        `This role is assigned to ${role.assigned_users_count} user(s). ` +
        `Deleting it will remove these assignments. Are you sure you want to continue?`
      )
      if (!confirmed) return
    } else {
      const confirmed = confirm(`Are you sure you want to delete the role "${role.name}"?`)
      if (!confirmed) return
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to delete role: ${response.status}`)
      }

      // Refresh roles list
      await fetchRoles()
    } catch (err) {
      console.error('Error deleting role:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete role')
    }
  }, [session?.access_token, fetchRoles])

  /**
   * Format permission count
   */
  const formatPermissionCount = (count: number): string => {
    if (count === 1) return '1 permission'
    return `${count} permissions`
  }

  /**
   * Get role badge variant
   */
  const getRoleBadgeVariant = (isCustom: boolean) => {
    return isCustom ? 'default' : 'secondary'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading roles...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Management
          </CardTitle>
          <CardDescription>
            Create and manage custom roles with specific permission sets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Actions */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search roles by name, description, or permissions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">{roles.length}</div>
              <div className="text-sm text-muted-foreground">Total Roles</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {roles.filter(r => r.is_custom).length}
              </div>
              <div className="text-sm text-muted-foreground">Custom Roles</div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold">
                {roles.filter(r => !r.is_custom).length}
              </div>
              <div className="text-sm text-muted-foreground">System Roles</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles List */}
      <div className="space-y-4">
        {filteredRoles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchQuery ? 'No roles found matching your search' : 'No roles found'}
            </CardContent>
          </Card>
        ) : (
          filteredRoles.map(role => (
            <Card key={role.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  {/* Role Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{role.name}</h3>
                          <Badge variant={getRoleBadgeVariant(role.is_custom)}>
                            {role.is_custom ? 'Custom' : 'System'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {role.description}
                        </p>
                      </div>
                    </div>

                    {/* Role Statistics */}
                    <div className="flex items-center gap-4 mt-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {formatPermissionCount(role.permissions.length)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {role.assigned_users_count} user(s)
                        </span>
                      </div>
                    </div>

                    {/* Permission Preview */}
                    <div className="flex flex-wrap gap-1 mt-3">
                      {role.permissions.slice(0, 8).map(permission => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {permission}
                        </Badge>
                      ))}
                      {role.permissions.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{role.permissions.length - 8} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    {role.is_custom && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingRole(role)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRole(role)}
                          className="flex items-center gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </Button>
                      </>
                    )}
                    {!role.is_custom && (
                      <Badge variant="secondary" className="px-3 py-1">
                        System Role
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Role Dialog */}
      {showCreateDialog && (
        <RoleCreation
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={handleRoleCreated}
        />
      )}

      {/* Edit Role Dialog */}
      {editingRole && (
        <RoleCreation
          open={!!editingRole}
          onClose={() => setEditingRole(null)}
          onSuccess={handleRoleUpdated}
          existingRole={editingRole}
        />
      )}
    </div>
  )
}

export default RoleManagement
