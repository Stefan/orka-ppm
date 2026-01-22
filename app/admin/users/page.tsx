'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../providers/SupabaseAuthProvider'
import { usePermissions } from '../../providers/EnhancedAuthProvider'
import { Users, UserPlus, UserMinus, UserX, Search, Filter, Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import AppLayout from '../../../components/shared/AppLayout'
import { getApiUrl } from '../../../lib/api'
import { useTranslations } from '@/lib/i18n/context'

interface User {
  id: string
  email: string
  role: string
  status: string
  is_active: boolean
  last_login: string | null
  created_at: string
  updated_at: string | null
  deactivated_at: string | null
  deactivated_by: string | null
  deactivation_reason: string | null
  sso_provider: string | null
  roles?: string[] // Array of assigned roles
  full_name?: string
}

interface RoleInfo {
  role: string
  permissions: string[]
  description: string
}

interface UserListResponse {
  users: User[]
  total_count: number
  page: number
  per_page: number
  total_pages: number
}

interface UserFilters {
  search: string
  status: string
  role: string
}

export default function AdminUsers() {
  const { session, user } = useAuth()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const router = useRouter()
  const t = useTranslations('adminUsers')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    status: '',
    role: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 20,
    total_count: 0,
    total_pages: 0
  })
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [availableRoles, setAvailableRoles] = useState<RoleInfo[]>([])
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Check if user has admin permissions
  // In development mode, allow access after a timeout if permissions loading fails
  const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  
  // Add a timeout state for development mode
  const [permissionTimeout, setPermissionTimeout] = useState(false)
  
  useEffect(() => {
    if (isDevelopment && permissionsLoading) {
      const timer = setTimeout(() => {
        console.log('Permission loading timeout - granting dev access')
        setPermissionTimeout(true)
      }, 3000) // 3 second timeout
      return () => clearTimeout(timer)
    }
  }, [isDevelopment, permissionsLoading])
  
  const isAdmin = hasPermission('user_manage') || (isDevelopment && (permissionTimeout || !permissionsLoading))
  const checkingAccess = permissionsLoading && !permissionTimeout

  // Redirect if not admin
  useEffect(() => {
    if (!permissionsLoading && !isAdmin && session) {
      // Redirect to home page after a short delay
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  }, [permissionsLoading, isAdmin, session, router])

  useEffect(() => {
    if (session && isAdmin) {
      fetchUsers()
      fetchAvailableRoles()
    }
  }, [session, pagination.page, isAdmin])

  // Debounced effect for filters to prevent excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (session && isAdmin) {
        setPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1 when filtering
        fetchUsers()
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [filters, session, isAdmin])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        per_page: pagination.per_page.toString()
      })
      
      if (filters.search.trim()) params.append('search', filters.search.trim())
      if (filters.status) params.append('status', filters.status)
      if (filters.role) params.append('role', filters.role)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
      
      const response = await fetch(getApiUrl(`/admin/users?${params}`), {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`)
      }
      
      const data: UserListResponse = await response.json()
      setUsers(data.users)
      setPagination(prev => ({
        ...prev,
        total_count: data.total_count,
        total_pages: data.total_pages
      }))
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn('Request timed out')
        setError(t('errors.timeout'))
      } else {
        console.error('Error fetching users:', error)
        setError(error instanceof Error ? error.message : t('errors.fetchFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableRoles = async () => {
    if (!session?.access_token) {
      console.warn('No session token available, skipping roles fetch')
      return
    }
    
    try {
      const url = getApiUrl('/admin/roles')
      console.log('Fetching roles from:', url)
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      })
      
      console.log('Roles response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch roles:', response.status, errorText)
        throw new Error(`Failed to fetch roles: ${response.status} ${response.statusText}`)
      }
      
      const roles: RoleInfo[] = await response.json()
      console.log('Fetched roles:', roles)
      setAvailableRoles(roles)
    } catch (error) {
      console.error('Error fetching roles:', error)
    }
  }

  const handleAssignRole = async (userId: string, role: string) => {
    setActionLoading(userId)
    
    try {
      const response = await fetch(getApiUrl(`/admin/users/${userId}/roles`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to assign role')
      }
      
      setSuccessMessage(`Role "${role}" assigned successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
      
      // Refresh users list
      await fetchUsers()
      
    } catch (error) {
      console.error('Error assigning role:', error)
      setError(error instanceof Error ? error.message : 'Failed to assign role')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemoveRole = async (userId: string, role: string) => {
    setActionLoading(userId)
    
    try {
      const response = await fetch(getApiUrl(`/admin/users/${userId}/roles/${role}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to remove role')
      }
      
      setSuccessMessage(`Role "${role}" removed successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
      
      // Refresh users list
      await fetchUsers()
      
    } catch (error) {
      console.error('Error removing role:', error)
      setError(error instanceof Error ? error.message : 'Failed to remove role')
    } finally {
      setActionLoading(null)
    }
  }

  const openRoleModal = (user: User) => {
    setSelectedUserForRole(user)
    setShowRoleModal(true)
  }

  const closeRoleModal = () => {
    setSelectedUserForRole(null)
    setShowRoleModal(false)
  }

  const handleUserAction = async (userId: string, action: 'deactivate' | 'activate' | 'delete', reason?: string) => {
    setActionLoading(userId)
    
    try {
      let endpoint = ''
      let method = 'POST'
      let body: any = {}
      
      switch (action) {
        case 'deactivate':
          endpoint = `/admin/users/${userId}/deactivate`
          body = { reason: reason || 'Admin action', notify_user: true }
          break
        case 'activate':
          endpoint = `/admin/users/${userId}`
          method = 'PUT'
          body = { is_active: true }
          break
        case 'delete':
          endpoint = `/admin/users/${userId}`
          method = 'DELETE'
          break
      }
      
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json',
        }
      }
      
      if (method !== 'DELETE' && body) {
        fetchOptions.body = JSON.stringify(body)
      }
      
      const response = await fetch(getApiUrl(endpoint), fetchOptions)
      
      if (!response.ok) {
        throw new Error(`Failed to ${action} user: ${response.statusText}`)
      }
      
      // Refresh users list
      await fetchUsers()
      
    } catch (error) {
      console.error(`Error ${action} user:`, error)
      setError(error instanceof Error ? error.message : t('errors.actionFailed', { action }))
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkAction = async (action: 'deactivate' | 'activate' | 'delete') => {
    if (selectedUsers.length === 0) return
    
    const reason = action === 'deactivate' || action === 'delete' 
      ? prompt(`Please provide a reason for ${action}ing ${selectedUsers.length} users:`)
      : null
    
    if ((action === 'deactivate' || action === 'delete') && !reason) return
    
    setActionLoading('bulk')
    
    try {
      // Process in smaller batches to avoid overwhelming the server
      const batchSize = 5
      for (let i = 0; i < selectedUsers.length; i += batchSize) {
        const batch = selectedUsers.slice(i, i + batchSize)
        const promises = batch.map(userId => 
          handleUserAction(userId, action, reason || undefined)
        )
        await Promise.all(promises)
      }
      
      setSelectedUsers([])
      await fetchUsers() // Refresh once after all operations
      
    } catch (error) {
      console.error(`Error in bulk ${action}:`, error)
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusIcon = (user: User) => {
    if (!user.is_active) {
      return <XCircle className="h-4 w-4 text-red-500" />
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }

  const getStatusText = (user: User) => {
    if (!user.is_active) return t('inactive')
    return t('active')
  }

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'manager': return 'bg-blue-100 text-blue-800'
      case 'user': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('never')
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (checkingAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    )
  }

  if (isAdmin === false) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-16 w-16 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-600 text-center max-w-md">
            You do not have permission to access this page. Only administrators can manage users and roles.
          </p>
          <p className="text-sm text-gray-500">Redirecting to home page...</p>
        </div>
      </AppLayout>
    )
  }

  if (loading && users.length === 0) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    )
  }

  // Role Management Modal Component
  const RoleManagementModal = () => {
    if (!showRoleModal || !selectedUserForRole) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Manage Roles</h2>
              <button
                onClick={closeRoleModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-lg font-medium text-blue-600">
                    {selectedUserForRole.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="text-lg font-medium text-gray-900">
                    {selectedUserForRole.full_name || selectedUserForRole.email}
                  </div>
                  <div className="text-sm text-gray-500">{selectedUserForRole.email}</div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Roles</h3>
              {selectedUserForRole.roles && selectedUserForRole.roles.length > 0 ? (
                <div className="space-y-2">
                  {selectedUserForRole.roles.map((role) => (
                    <div key={role} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="font-medium text-gray-900">{role}</div>
                          <div className="text-sm text-gray-500">
                            {availableRoles.find(r => r.role === role)?.description}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveRole(selectedUserForRole.id, role)}
                        disabled={actionLoading === selectedUserForRole.id}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        <UserMinus className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No roles assigned</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Roles</h3>
              <div className="space-y-2">
                {availableRoles
                  .filter(role => !selectedUserForRole.roles?.includes(role.role))
                  .map((roleInfo) => (
                    <div key={roleInfo.role} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Shield className="h-5 w-5 text-gray-600" />
                            <span className="font-medium text-gray-900">{roleInfo.role}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{roleInfo.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {roleInfo.permissions.slice(0, 5).map((permission) => (
                              <span
                                key={permission}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                              >
                                {permission}
                              </span>
                            ))}
                            {roleInfo.permissions.length > 5 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                +{roleInfo.permissions.length - 5} more
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssignRole(selectedUserForRole.id, roleInfo.role)}
                          disabled={actionLoading === selectedUserForRole.id}
                          className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>Assign</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={closeRoleModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <AppLayout>
      <RoleManagementModal />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
                <p className="text-sm text-gray-600">
                  {pagination.total_count} {t('usersTotal')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              {t('filters')}
            </button>
            
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
            
            <button
              onClick={() => {/* TODO: Implement invite user */}}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {t('inviteUser')}
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('searchByEmail')}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder={t('enterEmail')}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('status')}
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('allStatuses')}</option>
                  <option value="active">{t('active')}</option>
                  <option value="inactive">{t('inactive')}</option>
                  <option value="deactivated">{t('deactivated')}</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('role')}
                </label>
                <select
                  value={filters.role}
                  onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{t('allRoles')}</option>
                  <option value="admin">{t('admin')}</option>
                  <option value="manager">{t('manager')}</option>
                  <option value="user">{t('user')}</option>
                  <option value="viewer">{t('viewer')}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedUsers.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                {selectedUsers.length} {t('usersSelected')}
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBulkAction('activate')}
                  disabled={actionLoading === 'bulk'}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                >
                  {t('activate')}
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  disabled={actionLoading === 'bulk'}
                  className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50 text-sm"
                >
                  {t('deactivate')}
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  disabled={actionLoading === 'bulk'}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                >
                  {t('delete')}
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  {t('clear')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
              <span className="text-red-700">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
              <span className="text-green-700">{successMessage}</span>
              <button
                onClick={() => setSuccessMessage(null)}
                className="ml-auto text-green-400 hover:text-green-600"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUsers(users.map(u => u.id))
                        } else {
                          setSelectedUsers([])
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('tableHeaders.user')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('tableHeaders.role')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('tableHeaders.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('tableHeaders.lastLogin')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('tableHeaders.created')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('tableHeaders.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers(prev => [...prev, user.id])
                          } else {
                            setSelectedUsers(prev => prev.filter(id => id !== user.id))
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          {user.sso_provider && (
                            <div className="text-xs text-gray-500">{t('sso')}: {user.sso_provider}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(role)}`}
                            >
                              {role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </span>
                          ))
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                            {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                            {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getStatusIcon(user)}
                        <span className="ml-2 text-sm text-gray-900">{getStatusText(user)}</span>
                      </div>
                      {user.deactivated_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          {t('deactivatedAt')}: {formatDate(user.deactivated_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(user.last_login)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openRoleModal(user)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Manage Roles"
                        >
                          <Shield className="h-4 w-4" />
                        </button>
                        
                        {user.is_active ? (
                          <button
                            onClick={() => handleUserAction(user.id, 'deactivate', 'Admin deactivation')}
                            disabled={actionLoading === user.id}
                            className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                            title={t('deactivateUser')}
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserAction(user.id, 'activate')}
                            disabled={actionLoading === user.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title={t('activateUser')}
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            if (confirm(t('deleteConfirm', { email: user.email }))) {
                              handleUserAction(user.id, 'delete')
                            }
                          }}
                          disabled={actionLoading === user.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          title={t('deleteUser')}
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {users.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t('noUsersFound')}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filters.search || filters.status || filters.role 
                  ? t('tryAdjustingFilters')
                  : t('getStartedInvite')
                }
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              {t('showing')} {((pagination.page - 1) * pagination.per_page) + 1} {t('to')}{' '}
              {Math.min(pagination.page * pagination.per_page, pagination.total_count)} {t('of')}{' '}
              {pagination.total_count} {t('users')}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('previous')}
              </button>
              
              <span className="px-3 py-2 text-sm text-gray-700">
                {t('page')} {pagination.page} {t('of')} {pagination.total_pages}
              </span>
              
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.total_pages}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}