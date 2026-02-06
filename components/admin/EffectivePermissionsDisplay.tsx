'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Permission } from '@/types/rbac'

/**
 * User information
 */
interface UserInfo {
  id: string
  email: string
  full_name?: string
}

/**
 * Effective role with source information
 */
interface EffectiveRole {
  role_id: string
  role_name: string
  permissions: Permission[]
  source_type: 'global' | 'organization' | 'portfolio' | 'project'
  source_id?: string
  source_name?: string
  is_inherited: boolean
}

/**
 * User permissions response
 */
interface UserPermissionsData {
  user_id: string
  effective_roles: EffectiveRole[]
  permissions: Permission[]
  context_permissions?: Record<string, Permission[]>
}

interface EffectivePermissionsDisplayProps {
  user: UserInfo
  open: boolean
  onClose: () => void
}

/**
 * EffectivePermissionsDisplay Component
 * 
 * Displays effective permissions for a user, showing:
 * - All roles assigned to the user (global and scoped)
 * - Aggregated permissions from all roles
 * - Permission inheritance information
 * - Permissions grouped by category
 * 
 * Requirements: 4.4 - Display effective permissions including inherited permissions
 */
export function EffectivePermissionsDisplay({
  user,
  open,
  onClose,
}: EffectivePermissionsDisplayProps) {
  const { session } = useAuth()
  const [permissionsData, setPermissionsData] = useState<UserPermissionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch user's effective permissions
   */
  const fetchPermissions = useCallback(async () => {
    if (!session?.access_token || !user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(
        `${apiUrl}/api/admin/users/${user.id}/effective-permissions`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch permissions: ${response.status}`)
      }

      const data = await response.json()
      setPermissionsData(data)
    } catch (err) {
      console.error('Error fetching permissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token, user])

  /**
   * Load permissions when dialog opens
   */
  useEffect(() => {
    if (open) {
      fetchPermissions()
    }
  }, [open, fetchPermissions])

  /**
   * Group permissions by category
   */
  const groupPermissionsByCategory = (permissions: Permission[]) => {
    const categories: Record<string, Permission[]> = {
      Portfolio: [],
      Project: [],
      Resource: [],
      Financial: [],
      'Risk & Issue': [],
      AI: [],
      Admin: [],
      PMR: [],
      'Shareable URLs': [],
      Simulation: [],
      Scenario: [],
      Other: [],
    }

    permissions.forEach(permission => {
      if (permission.startsWith('portfolio_')) {
        categories.Portfolio.push(permission)
      } else if (permission.startsWith('project_')) {
        categories.Project.push(permission)
      } else if (permission.startsWith('resource_')) {
        categories.Resource.push(permission)
      } else if (permission.startsWith('financial_') || permission.startsWith('budget_')) {
        categories.Financial.push(permission)
      } else if (permission.startsWith('risk_') || permission.startsWith('issue_')) {
        categories['Risk & Issue'].push(permission)
      } else if (permission.startsWith('ai_')) {
        categories.AI.push(permission)
      } else if (
        permission.startsWith('user_') ||
        permission.startsWith('role_') ||
        permission.startsWith('admin_') ||
        permission === 'system_admin' ||
        permission === 'data_import'
      ) {
        categories.Admin.push(permission)
      } else if (permission.startsWith('pmr_')) {
        categories.PMR.push(permission)
      } else if (permission.startsWith('shareable_url_')) {
        categories['Shareable URLs'].push(permission)
      } else if (permission.startsWith('simulation_')) {
        categories.Simulation.push(permission)
      } else if (permission.startsWith('scenario_')) {
        categories.Scenario.push(permission)
      } else {
        categories.Other.push(permission)
      }
    })

    // Remove empty categories
    return Object.entries(categories).filter(([_, perms]) => perms.length > 0)
  }

  /**
   * Format permission name for display
   */
  const formatPermissionName = (permission: Permission): string => {
    return permission
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  /**
   * Get scope badge variant
   */
  const getScopeBadgeVariant = (scopeType: string) => {
    switch (scopeType) {
      case 'global':
        return 'default'
      case 'organization':
        return 'secondary'
      case 'portfolio':
        return 'outline'
      case 'project':
        return 'outline'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading permissions...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px]">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    )
  }

  const groupedPermissions = permissionsData
    ? groupPermissionsByCategory(permissionsData.permissions)
    : []

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Effective Permissions
          </DialogTitle>
          <DialogDescription>
            Viewing permissions for <strong>{user.full_name || user.email}</strong>
          </DialogDescription>
        </DialogHeader>

        {permissionsData && (
          <Tabs defaultValue="roles" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="roles">Roles & Sources</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
            </TabsList>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-4">
              {/* Summary */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>
                      <strong>{permissionsData.effective_roles.length}</strong> role(s) assigned
                    </span>
                    <span>
                      <strong>{permissionsData.permissions.length}</strong> total permissions
                    </span>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Effective Roles */}
              <div className="space-y-3">
                {permissionsData.effective_roles.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No roles assigned to this user
                    </CardContent>
                  </Card>
                ) : (
                  permissionsData.effective_roles.map((role, index) => (
                    <Card key={`${role.role_id}-${index}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            {role.role_name}
                            {role.is_inherited && (
                              <Badge variant="outline" className="text-xs">
                                Inherited
                              </Badge>
                            )}
                          </CardTitle>
                          <Badge variant={getScopeBadgeVariant(role.source_type)}>
                            {role.source_type}
                            {role.source_name && `: ${role.source_name}`}
                          </Badge>
                        </div>
                        <CardDescription>
                          {role.permissions.length} permission(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1">
                          {role.permissions.slice(0, 10).map(perm => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              {formatPermissionName(perm)}
                            </Badge>
                          ))}
                          {role.permissions.length > 10 && (
                            <Badge variant="outline" className="text-xs">
                              +{role.permissions.length - 10} more
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="space-y-4">
              {/* Summary */}
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  This user has <strong>{permissionsData.permissions.length}</strong> unique
                  permissions across <strong>{groupedPermissions.length}</strong> categories
                </AlertDescription>
              </Alert>

              {/* Grouped Permissions */}
              <div className="space-y-4">
                {groupedPermissions.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No permissions assigned to this user
                    </CardContent>
                  </Card>
                ) : (
                  groupedPermissions.map(([category, permissions]) => (
                    <Card key={category}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">{category}</CardTitle>
                        <CardDescription>
                          {permissions.length} permission(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                          {permissions.map(perm => (
                            <div
                              key={perm}
                              className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                            >
                              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                              <span className="truncate">{formatPermissionName(perm)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default EffectivePermissionsDisplay
