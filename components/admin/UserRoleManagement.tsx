'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { getApiUrl } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Loader2, Search, UserPlus, Shield, AlertCircle } from 'lucide-react'
import { RoleAssignmentDialog } from './RoleAssignmentDialog'
import { EffectivePermissionsDisplay } from './EffectivePermissionsDisplay'
import type { Permission } from '@/types/rbac'

/**
 * User with role information
 */
interface UserWithRoles {
  id: string
  email: string
  full_name?: string
  roles: Array<{
    id: string
    name: string
    scope_type?: string
    scope_id?: string
    assigned_at: string
  }>
}

/**
 * UserRoleManagement Component
 * 
 * Comprehensive interface for viewing and modifying user role assignments.
 * Supports:
 * - Viewing all users and their assigned roles
 * - Adding new role assignments with scope selection
 * - Removing role assignments
 * - Viewing effective permissions for each user
 * 
 * Requirements: 4.1, 4.4 - User role management and effective permissions display
 */
export function UserRoleManagement() {
  const { session } = useAuth()
  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserWithRoles[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false)

  /**
   * Fetch all users with their role assignments
   */
  const fetchUsers = useCallback(async () => {
    if (!session?.access_token) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(getApiUrl('/api/admin/users-with-roles'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`)
      }

      const data = await response.json()
      setUsers(data)
      setFilteredUsers(data)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  /**
   * Filter users based on search query
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(user => 
      user.email.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.roles.some(role => role.name.toLowerCase().includes(query))
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  /**
   * Load users on mount
   */
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  /**
   * Handle role assignment success
   */
  const handleRoleAssigned = useCallback(() => {
    setShowAssignDialog(false)
    setSelectedUser(null)
    fetchUsers() // Refresh the user list
  }, [fetchUsers])

  /**
   * Handle role removal
   */
  const handleRemoveRole = useCallback(async (userId: string, roleId: string) => {
    if (!session?.access_token) {
      setError('Not authenticated')
      return
    }

    if (!confirm('Are you sure you want to remove this role assignment?')) {
      return
    }

    try {
      const response = await fetch(getApiUrl(`/api/admin/users/${userId}/roles/${roleId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to remove role: ${response.status}`)
      }

      // Refresh the user list
      await fetchUsers()
    } catch (err) {
      console.error('Error removing role:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove role')
    }
  }, [session?.access_token, fetchUsers])

  /**
   * Handle view effective permissions
   */
  const handleViewPermissions = useCallback((user: UserWithRoles) => {
    setSelectedUser(user)
    setShowPermissionsDialog(true)
  }, [])

  /**
   * Handle assign role
   */
  const handleAssignRole = useCallback((user: UserWithRoles) => {
    setSelectedUser(user)
    setShowAssignDialog(true)
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading users...</span>
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
            User Role Management
          </CardTitle>
          <CardDescription>
            View and manage user role assignments with scope-based access control
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => setShowAssignDialog(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Assign Role
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {searchQuery ? 'No users found matching your search' : 'No users found'}
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map(user => (
            <Card key={user.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold">{user.full_name || user.email}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>

                    {/* Role Badges */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {user.roles.length === 0 ? (
                        <Badge variant="outline" className="text-muted-foreground">
                          No roles assigned
                        </Badge>
                      ) : (
                        user.roles.map(role => (
                          <Badge
                            key={role.id}
                            variant="secondary"
                            className="flex items-center gap-2"
                          >
                            <span>{role.name}</span>
                            {role.scope_type && role.scope_type !== 'global' && (
                              <span className="text-xs opacity-70">
                                ({role.scope_type})
                              </span>
                            )}
                            <button
                              onClick={() => handleRemoveRole(user.id, role.id)}
                              className="ml-1 hover:text-destructive"
                              aria-label={`Remove ${role.name} role`}
                            >
                              ×
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPermissions(user)}
                    >
                      View Permissions
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleAssignRole(user)}
                    >
                      Assign Role
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Role Assignment Dialog */}
      {showAssignDialog && (
        <RoleAssignmentDialog
          user={selectedUser}
          open={showAssignDialog}
          onClose={() => {
            setShowAssignDialog(false)
            setSelectedUser(null)
          }}
          onSuccess={handleRoleAssigned}
        />
      )}

      {/* Effective Permissions Dialog */}
      {showPermissionsDialog && selectedUser && (
        <EffectivePermissionsDisplay
          user={selectedUser}
          open={showPermissionsDialog}
          onClose={() => {
            setShowPermissionsDialog(false)
            setSelectedUser(null)
          }}
        />
      )}
    </div>
  )
}

export default UserRoleManagement
