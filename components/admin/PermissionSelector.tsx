'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/atoms/Checkbox'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/badge'
import { Search, CheckCircle2, Circle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Permission } from '@/types/rbac'

/**
 * Permission category definition
 */
interface PermissionCategory {
  name: string
  description: string
  permissions: {
    permission: Permission
    label: string
    description: string
    requiresRead?: Permission
  }[]
}

/**
 * All available permissions grouped by category
 */
const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    name: 'Portfolio',
    description: 'Manage portfolios and portfolio-level operations',
    permissions: [
      { permission: 'portfolio_read', label: 'Read', description: 'View portfolio information' },
      { permission: 'portfolio_create', label: 'Create', description: 'Create new portfolios', requiresRead: 'portfolio_read' },
      { permission: 'portfolio_update', label: 'Update', description: 'Modify existing portfolios', requiresRead: 'portfolio_read' },
      { permission: 'portfolio_delete', label: 'Delete', description: 'Delete portfolios', requiresRead: 'portfolio_read' },
    ],
  },
  {
    name: 'Project',
    description: 'Manage projects and project-level operations',
    permissions: [
      { permission: 'project_read', label: 'Read', description: 'View project information' },
      { permission: 'project_create', label: 'Create', description: 'Create new projects', requiresRead: 'project_read' },
      { permission: 'project_update', label: 'Update', description: 'Modify existing projects', requiresRead: 'project_read' },
      { permission: 'project_delete', label: 'Delete', description: 'Delete projects', requiresRead: 'project_read' },
    ],
  },
  {
    name: 'Resource',
    description: 'Manage resources and resource allocations',
    permissions: [
      { permission: 'resource_read', label: 'Read', description: 'View resource information' },
      { permission: 'resource_create', label: 'Create', description: 'Create new resources', requiresRead: 'resource_read' },
      { permission: 'resource_update', label: 'Update', description: 'Modify existing resources', requiresRead: 'resource_read' },
      { permission: 'resource_delete', label: 'Delete', description: 'Delete resources', requiresRead: 'resource_read' },
      { permission: 'resource_allocate', label: 'Allocate', description: 'Allocate resources to projects', requiresRead: 'resource_read' },
    ],
  },
  {
    name: 'Financial',
    description: 'Manage financial data and budgets',
    permissions: [
      { permission: 'financial_read', label: 'Read', description: 'View financial information' },
      { permission: 'financial_create', label: 'Create', description: 'Create financial records', requiresRead: 'financial_read' },
      { permission: 'financial_update', label: 'Update', description: 'Modify financial records', requiresRead: 'financial_read' },
      { permission: 'financial_delete', label: 'Delete', description: 'Delete financial records', requiresRead: 'financial_read' },
      { permission: 'budget_alert_manage', label: 'Manage Alerts', description: 'Manage budget alerts', requiresRead: 'financial_read' },
    ],
  },
  {
    name: 'Risk & Issue',
    description: 'Manage risks and issues',
    permissions: [
      { permission: 'risk_read', label: 'Read Risks', description: 'View risk information' },
      { permission: 'risk_create', label: 'Create Risks', description: 'Create new risks', requiresRead: 'risk_read' },
      { permission: 'risk_update', label: 'Update Risks', description: 'Modify existing risks', requiresRead: 'risk_read' },
      { permission: 'risk_delete', label: 'Delete Risks', description: 'Delete risks', requiresRead: 'risk_read' },
      { permission: 'issue_read', label: 'Read Issues', description: 'View issue information' },
      { permission: 'issue_create', label: 'Create Issues', description: 'Create new issues', requiresRead: 'issue_read' },
      { permission: 'issue_update', label: 'Update Issues', description: 'Modify existing issues', requiresRead: 'issue_read' },
      { permission: 'issue_delete', label: 'Delete Issues', description: 'Delete issues', requiresRead: 'issue_read' },
    ],
  },
  {
    name: 'AI Features',
    description: 'Access AI-powered features and insights',
    permissions: [
      { permission: 'ai_rag_query', label: 'RAG Query', description: 'Query AI knowledge base' },
      { permission: 'ai_resource_optimize', label: 'Resource Optimization', description: 'Use AI resource optimization' },
      { permission: 'ai_risk_forecast', label: 'Risk Forecasting', description: 'Use AI risk forecasting' },
      { permission: 'ai_metrics_read', label: 'Metrics', description: 'View AI metrics and insights' },
    ],
  },
  {
    name: 'PMR',
    description: 'Project Management Reports',
    permissions: [
      { permission: 'pmr_read', label: 'Read', description: 'View PMR reports' },
      { permission: 'pmr_create', label: 'Create', description: 'Create new PMR reports', requiresRead: 'pmr_read' },
      { permission: 'pmr_update', label: 'Update', description: 'Modify PMR reports', requiresRead: 'pmr_read' },
      { permission: 'pmr_delete', label: 'Delete', description: 'Delete PMR reports', requiresRead: 'pmr_read' },
      { permission: 'pmr_approve', label: 'Approve', description: 'Approve PMR reports', requiresRead: 'pmr_read' },
      { permission: 'pmr_export', label: 'Export', description: 'Export PMR reports', requiresRead: 'pmr_read' },
      { permission: 'pmr_collaborate', label: 'Collaborate', description: 'Collaborate on PMR reports', requiresRead: 'pmr_read' },
      { permission: 'pmr_ai_insights', label: 'AI Insights', description: 'Access AI insights in PMR', requiresRead: 'pmr_read' },
      { permission: 'pmr_template_manage', label: 'Manage Templates', description: 'Manage PMR templates', requiresRead: 'pmr_read' },
      { permission: 'pmr_audit_read', label: 'Audit Trail', description: 'View PMR audit trail', requiresRead: 'pmr_read' },
    ],
  },
  {
    name: 'Shareable URLs',
    description: 'Manage shareable project URLs',
    permissions: [
      { permission: 'shareable_url_read', label: 'Read', description: 'View shareable URLs' },
      { permission: 'shareable_url_create', label: 'Create', description: 'Create shareable URLs', requiresRead: 'shareable_url_read' },
      { permission: 'shareable_url_revoke', label: 'Revoke', description: 'Revoke shareable URLs', requiresRead: 'shareable_url_read' },
      { permission: 'shareable_url_manage', label: 'Manage', description: 'Full shareable URL management', requiresRead: 'shareable_url_read' },
    ],
  },
  {
    name: 'Simulation',
    description: 'Monte Carlo simulations',
    permissions: [
      { permission: 'simulation_read', label: 'Read', description: 'View simulation results' },
      { permission: 'simulation_run', label: 'Run', description: 'Run simulations', requiresRead: 'simulation_read' },
      { permission: 'simulation_delete', label: 'Delete', description: 'Delete simulations', requiresRead: 'simulation_read' },
      { permission: 'simulation_manage', label: 'Manage', description: 'Full simulation management', requiresRead: 'simulation_read' },
    ],
  },
  {
    name: 'Scenario',
    description: 'What-If scenario analysis',
    permissions: [
      { permission: 'scenario_read', label: 'Read', description: 'View scenarios' },
      { permission: 'scenario_create', label: 'Create', description: 'Create scenarios', requiresRead: 'scenario_read' },
      { permission: 'scenario_update', label: 'Update', description: 'Modify scenarios', requiresRead: 'scenario_read' },
      { permission: 'scenario_delete', label: 'Delete', description: 'Delete scenarios', requiresRead: 'scenario_read' },
      { permission: 'scenario_compare', label: 'Compare', description: 'Compare scenarios', requiresRead: 'scenario_read' },
    ],
  },
  {
    name: 'Admin',
    description: 'Administrative and system management',
    permissions: [
      { permission: 'admin_read', label: 'Read', description: 'View admin information' },
      { permission: 'admin_update', label: 'Update', description: 'Modify admin settings', requiresRead: 'admin_read' },
      { permission: 'admin_delete', label: 'Delete', description: 'Delete admin data', requiresRead: 'admin_read' },
      { permission: 'user_manage', label: 'Manage Users', description: 'Manage user accounts' },
      { permission: 'role_manage', label: 'Manage Roles', description: 'Manage roles and permissions' },
      { permission: 'system_admin', label: 'System Admin', description: 'Full system access (grants all permissions)' },
      { permission: 'data_import', label: 'Data Import', description: 'Import data into the system' },
    ],
  },
]

interface PermissionSelectorProps {
  selectedPermissions: Permission[]
  onChange: (permissions: Permission[]) => void
  disabled?: boolean
}

/**
 * PermissionSelector Component
 * 
 * Component for selecting permissions when creating or editing custom roles.
 * Features:
 * - Permissions grouped by category
 * - Search/filter functionality
 * - Visual indication of selected permissions
 * - Automatic dependency handling (e.g., write requires read)
 * - Select all/none per category
 * 
 * Requirements: 4.2, 4.3 - Permission selection with validation
 */
export function PermissionSelector({
  selectedPermissions,
  onChange,
  disabled = false,
}: PermissionSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  /**
   * Filter permissions based on search query
   */
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return PERMISSION_CATEGORIES
    }

    const query = searchQuery.toLowerCase()
    return PERMISSION_CATEGORIES.map(category => ({
      ...category,
      permissions: category.permissions.filter(
        perm =>
          perm.label.toLowerCase().includes(query) ||
          perm.description.toLowerCase().includes(query) ||
          perm.permission.toLowerCase().includes(query)
      ),
    })).filter(category => category.permissions.length > 0)
  }, [searchQuery])

  /**
   * Handle permission toggle
   */
  const handlePermissionToggle = (permission: Permission, requiresRead?: Permission) => {
    if (disabled) return

    const isSelected = selectedPermissions.includes(permission)
    let newPermissions: Permission[]

    if (isSelected) {
      // Remove permission
      newPermissions = selectedPermissions.filter(p => p !== permission)
    } else {
      // Add permission
      newPermissions = [...selectedPermissions, permission]
      
      // Auto-add required read permission if needed
      if (requiresRead && !selectedPermissions.includes(requiresRead)) {
        newPermissions.push(requiresRead)
      }
    }

    onChange(newPermissions)
  }

  /**
   * Handle select all in category
   */
  const handleSelectAllInCategory = (category: PermissionCategory) => {
    if (disabled) return

    const categoryPermissions = category.permissions.map(p => p.permission)
    const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p))

    let newPermissions: Permission[]
    if (allSelected) {
      // Deselect all in category
      newPermissions = selectedPermissions.filter(p => !categoryPermissions.includes(p))
    } else {
      // Select all in category
      const toAdd = categoryPermissions.filter(p => !selectedPermissions.includes(p))
      newPermissions = [...selectedPermissions, ...toAdd]
    }

    onChange(newPermissions)
  }

  /**
   * Check if all permissions in category are selected
   */
  const isCategoryFullySelected = (category: PermissionCategory): boolean => {
    return category.permissions.every(p => selectedPermissions.includes(p.permission))
  }

  /**
   * Check if some permissions in category are selected
   */
  const isCategoryPartiallySelected = (category: PermissionCategory): boolean => {
    const selected = category.permissions.filter(p => selectedPermissions.includes(p.permission))
    return selected.length > 0 && selected.length < category.permissions.length
  }

  /**
   * Get category statistics
   */
  const getCategoryStats = (category: PermissionCategory) => {
    const selected = category.permissions.filter(p => selectedPermissions.includes(p.permission)).length
    const total = category.permissions.length
    return { selected, total }
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search permissions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="pl-10"
        />
      </div>

      {/* Tabs for View Options */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Categories</TabsTrigger>
          <TabsTrigger value="selected">
            Selected ({selectedPermissions.length})
          </TabsTrigger>
        </TabsList>

        {/* All Categories View */}
        <TabsContent value="all" className="space-y-4 mt-4">
          {filteredCategories.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No permissions found matching your search
              </CardContent>
            </Card>
          ) : (
            filteredCategories.map(category => {
              const stats = getCategoryStats(category)
              const fullySelected = isCategoryFullySelected(category)
              const partiallySelected = isCategoryPartiallySelected(category)

              return (
                <Card key={category.name}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={fullySelected}
                          onCheckedChange={() => handleSelectAllInCategory(category)}
                          disabled={disabled}
                          className={partiallySelected ? 'data-[state=checked]:bg-primary/50' : ''}
                        />
                        <div>
                          <CardTitle className="text-base">{category.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {category.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={stats.selected > 0 ? 'default' : 'outline'}>
                        {stats.selected}/{stats.total}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {category.permissions.map(perm => {
                        const isSelected = selectedPermissions.includes(perm.permission)
                        return (
                          <div
                            key={perm.permission}
                            className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                              isSelected
                                ? 'bg-primary/5 border-primary/20'
                                : 'bg-muted/30 border-transparent hover:border-muted-foreground/20'
                            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            onClick={() => handlePermissionToggle(perm.permission, perm.requiresRead)}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={disabled}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{perm.label}</span>
                                {perm.requiresRead && (
                                  <Badge variant="outline" className="text-xs">
                                    requires read
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {perm.description}
                              </p>
                              <code className="text-xs text-muted-foreground/70 mt-1 block">
                                {perm.permission}
                              </code>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* Selected Permissions View */}
        <TabsContent value="selected" className="space-y-4 mt-4">
          {selectedPermissions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Circle className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No permissions selected</p>
                <p className="text-xs mt-1">Select permissions from the "All Categories" tab</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Selected Permissions</CardTitle>
                <CardDescription>
                  {selectedPermissions.length} permission(s) selected
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedPermissions.map(permission => (
                    <Badge
                      key={permission}
                      variant="secondary"
                      className="flex items-center gap-1 px-3 py-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{permission}</span>
                      {!disabled && (
                        <button
                          onClick={() => handlePermissionToggle(permission)}
                          className="ml-1 hover:text-destructive"
                          aria-label={`Remove ${permission}`}
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default PermissionSelector
