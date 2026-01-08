'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../../providers/SupabaseAuthProvider'
import { Users, UserPlus, UserMinus, UserX, Search, Filter, Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import AppLayout from '../../../components/AppLayout'
import { getApiUrl } from '../../../lib/api'

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
  const { session } = useAuth()
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

  useEffect(() => {
    if (session) {
      fetchUsers()
    }
  }, [session, pagination.page])

  // Debounced effect for filters to prevent excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (session) {
        setPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1 when filtering
        fetchUsers()
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [filters, session])

  const fetchUsers = async () => {
    if (loading) return // Prevent concurrent requests
    
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
        setError('Request timed out. Please try again.')
      } else {
        console.error('Error fetching users:', error)
        setError(error instanceof Error ? error.message : 'Failed to fetch users')
      }
    } finally {
      setLoading(false)
    }
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
      setError(error instanceof Error ? error.message : `Failed to ${action} user`)
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
    if (!user.is_active) return 'Inactive'
    return 'Active'
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
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div>
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-600">
                  {pagination.total_count} users total
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
              Filters
            </button>
            
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={() => {/* TODO: Implement invite user */}}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search by email
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    placeholder="Enter email..."
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={filters.role}
                  onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="user">User</option>
                  <option value="viewer">Viewer</option>
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
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBulkAction('activate')}
                  disabled={actionLoading === 'bulk'}
                  className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-sm"
                >
                  Activate
                </button>
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  disabled={actionLoading === 'bulk'}
                  className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 disabled:opacity-50 text-sm"
                >
                  Deactivate
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  disabled={actionLoading === 'bulk'}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedUsers([])}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                >
                  Clear
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
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
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
                            <div className="text-xs text-gray-500">SSO: {user.sso_provider}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                        {user.role === 'admin' && <Shield className="h-3 w-3 mr-1" />}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {getStatusIcon(user)}
                        <span className="ml-2 text-sm text-gray-900">{getStatusText(user)}</span>
                      </div>
                      {user.deactivated_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          Deactivated: {formatDate(user.deactivated_at)}
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
                        {user.is_active ? (
                          <button
                            onClick={() => handleUserAction(user.id, 'deactivate', 'Admin deactivation')}
                            disabled={actionLoading === user.id}
                            className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                            title="Deactivate user"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserAction(user.id, 'activate')}
                            disabled={actionLoading === user.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Activate user"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
                              handleUserAction(user.id, 'delete')
                            }
                          }}
                          disabled={actionLoading === user.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          title="Delete user"
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filters.search || filters.status || filters.role 
                  ? 'Try adjusting your filters' 
                  : 'Get started by inviting your first user'
                }
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((pagination.page - 1) * pagination.per_page) + 1} to{' '}
              {Math.min(pagination.page * pagination.per_page, pagination.total_count)} of{' '}
              {pagination.total_count} users
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="px-3 py-2 text-sm text-gray-700">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.total_pages}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}