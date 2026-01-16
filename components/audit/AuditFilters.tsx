'use client'

import React, { useState, useCallback, useMemo } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import {
  Calendar,
  X,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  User,
  Tag,
  AlertTriangle,
  Shield,
  DollarSign,
  Users,
  FileText
} from 'lucide-react'

/**
 * Audit Filters Interface
 */
export interface AuditFilters {
  dateRange?: {
    start: Date | null
    end: Date | null
  }
  eventTypes?: string[]
  userIds?: string[]
  entityTypes?: string[]
  severity?: string[]
  categories?: string[]
  riskLevels?: string[]
  showAnomaliesOnly?: boolean
}

/**
 * User Option Interface
 */
export interface UserOption {
  id: string
  name: string
  email?: string
}

/**
 * AuditFilters Props
 */
export interface AuditFiltersProps {
  filters: AuditFilters
  onChange: (filters: AuditFilters) => void
  availableEventTypes?: string[]
  availableUsers?: UserOption[]
  availableEntityTypes?: string[]
  className?: string
  showAdvancedFilters?: boolean
}

/**
 * Default event types
 */
const DEFAULT_EVENT_TYPES = [
  'user_login',
  'user_logout',
  'budget_change',
  'permission_change',
  'resource_assignment',
  'risk_created',
  'risk_updated',
  'report_generated',
  'project_created',
  'project_updated',
  'change_request_created',
  'change_request_approved'
]

/**
 * Default entity types
 */
const DEFAULT_ENTITY_TYPES = [
  'project',
  'resource',
  'risk',
  'change_request',
  'budget',
  'user',
  'report'
]

/**
 * Severity levels
 */
const SEVERITY_LEVELS = [
  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-700' },
  { value: 'warning', label: 'Warning', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'error', label: 'Error', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' }
]

/**
 * Categories
 */
const CATEGORIES = [
  { value: 'Security Change', label: 'Security Change', icon: Shield },
  { value: 'Financial Impact', label: 'Financial Impact', icon: DollarSign },
  { value: 'Resource Allocation', label: 'Resource Allocation', icon: Users },
  { value: 'Risk Event', label: 'Risk Event', icon: AlertTriangle },
  { value: 'Compliance Action', label: 'Compliance Action', icon: FileText }
]

/**
 * Risk levels
 */
const RISK_LEVELS = [
  { value: 'Low', label: 'Low', color: 'bg-green-100 text-green-700' },
  { value: 'Medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'High', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'Critical', label: 'Critical', color: 'bg-red-100 text-red-700' }
]

/**
 * AuditFilters Component
 * 
 * Comprehensive filter component for audit events.
 * Features:
 * - Date range picker with react-datepicker
 * - Event type multi-select
 * - User selector with autocomplete
 * - Entity type selector
 * - Severity filter (radio buttons)
 * - Category filter (checkboxes)
 * - Risk level filter (checkboxes)
 * - Filter reset functionality
 * - Collapsible advanced filters
 */
const AuditFilters: React.FC<AuditFiltersProps> = ({
  filters,
  onChange,
  availableEventTypes = DEFAULT_EVENT_TYPES,
  availableUsers = [],
  availableEntityTypes = DEFAULT_ENTITY_TYPES,
  className = '',
  showAdvancedFilters = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  /**
   * Filter users based on search query
   */
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return availableUsers
    const query = userSearchQuery.toLowerCase()
    return availableUsers.filter(
      user =>
        user.name.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    )
  }, [availableUsers, userSearchQuery])

  /**
   * Handle date range change
   */
  const handleDateRangeChange = useCallback(
    (field: 'start' | 'end', date: Date | null) => {
      onChange({
        ...filters,
        dateRange: {
          start: field === 'start' ? date : filters.dateRange?.start || null,
          end: field === 'end' ? date : filters.dateRange?.end || null
        }
      })
    },
    [filters, onChange]
  )

  /**
   * Handle event type toggle
   */
  const handleEventTypeToggle = useCallback(
    (eventType: string) => {
      const currentTypes = filters.eventTypes || []
      const newTypes = currentTypes.includes(eventType)
        ? currentTypes.filter(t => t !== eventType)
        : [...currentTypes, eventType]
      onChange({ ...filters, eventTypes: newTypes })
    },
    [filters, onChange]
  )

  /**
   * Handle user selection
   */
  const handleUserSelect = useCallback(
    (userId: string) => {
      const currentUsers = filters.userIds || []
      const newUsers = currentUsers.includes(userId)
        ? currentUsers.filter(id => id !== userId)
        : [...currentUsers, userId]
      onChange({ ...filters, userIds: newUsers })
      setUserSearchQuery('')
      setShowUserDropdown(false)
    },
    [filters, onChange]
  )

  /**
   * Handle entity type toggle
   */
  const handleEntityTypeToggle = useCallback(
    (entityType: string) => {
      const currentTypes = filters.entityTypes || []
      const newTypes = currentTypes.includes(entityType)
        ? currentTypes.filter(t => t !== entityType)
        : [...currentTypes, entityType]
      onChange({ ...filters, entityTypes: newTypes })
    },
    [filters, onChange]
  )

  /**
   * Handle severity selection (radio button behavior)
   */
  const handleSeveritySelect = useCallback(
    (severity: string) => {
      const currentSeverity = filters.severity || []
      const newSeverity = currentSeverity.includes(severity)
        ? currentSeverity.filter(s => s !== severity)
        : [...currentSeverity, severity]
      onChange({ ...filters, severity: newSeverity })
    },
    [filters, onChange]
  )

  /**
   * Handle category toggle
   */
  const handleCategoryToggle = useCallback(
    (category: string) => {
      const currentCategories = filters.categories || []
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category]
      onChange({ ...filters, categories: newCategories })
    },
    [filters, onChange]
  )

  /**
   * Handle risk level toggle
   */
  const handleRiskLevelToggle = useCallback(
    (riskLevel: string) => {
      const currentLevels = filters.riskLevels || []
      const newLevels = currentLevels.includes(riskLevel)
        ? currentLevels.filter(l => l !== riskLevel)
        : [...currentLevels, riskLevel]
      onChange({ ...filters, riskLevels: newLevels })
    },
    [filters, onChange]
  )

  /**
   * Handle anomalies only toggle
   */
  const handleAnomaliesOnlyToggle = useCallback(() => {
    onChange({ ...filters, showAnomaliesOnly: !filters.showAnomaliesOnly })
  }, [filters, onChange])

  /**
   * Reset all filters
   */
  const handleReset = useCallback(() => {
    onChange({
      dateRange: { start: null, end: null },
      eventTypes: [],
      userIds: [],
      entityTypes: [],
      severity: [],
      categories: [],
      riskLevels: [],
      showAnomaliesOnly: false
    })
    setUserSearchQuery('')
  }, [onChange])

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.dateRange?.start !== null && filters.dateRange?.start !== undefined) ||
      (filters.dateRange?.end !== null && filters.dateRange?.end !== undefined) ||
      (filters.eventTypes && filters.eventTypes.length > 0) ||
      (filters.userIds && filters.userIds.length > 0) ||
      (filters.entityTypes && filters.entityTypes.length > 0) ||
      (filters.severity && filters.severity.length > 0) ||
      (filters.categories && filters.categories.length > 0) ||
      (filters.riskLevels && filters.riskLevels.length > 0) ||
      filters.showAnomaliesOnly
    )
  }, [filters])

  /**
   * Get selected user names
   */
  const selectedUserNames = useMemo(() => {
    if (!filters.userIds || filters.userIds.length === 0) return []
    return filters.userIds
      .map(id => availableUsers.find(u => u.id === id)?.name)
      .filter(Boolean) as string[]
  }, [filters.userIds, availableUsers])

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`} data-testid="audit-filters">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          {showAdvancedFilters && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title={isExpanded ? 'Collapse filters' : 'Expand filters'}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Basic Filters (Always Visible) */}
      <div className="p-4 space-y-4">
        {/* Date Range Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 inline mr-1" />
            Date Range
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Start Date</label>
              <DatePicker
                selected={filters.dateRange?.start || null}
                onChange={(date) => handleDateRangeChange('start', date)}
                selectsStart
                startDate={filters.dateRange?.start || null}
                endDate={filters.dateRange?.end || null}
                maxDate={filters.dateRange?.end || new Date()}
                placeholderText="Select start date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                dateFormat="MMM d, yyyy"
                isClearable
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">End Date</label>
              <DatePicker
                selected={filters.dateRange?.end || null}
                onChange={(date) => handleDateRangeChange('end', date)}
                selectsEnd
                startDate={filters.dateRange?.start || null}
                endDate={filters.dateRange?.end || null}
                minDate={filters.dateRange?.start || null}
                maxDate={new Date()}
                placeholderText="Select end date"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                dateFormat="MMM d, yyyy"
                isClearable
              />
            </div>
          </div>
        </div>

        {/* Event Type Multi-Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Types
          </label>
          <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
            {availableEventTypes.map((eventType) => (
              <label
                key={eventType}
                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.eventTypes?.includes(eventType) ?? false}
                  onChange={() => handleEventTypeToggle(eventType)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{eventType.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
          {filters.eventTypes && filters.eventTypes.length > 0 && (
            <p className="text-xs text-gray-600 mt-1">
              {filters.eventTypes.length} type{filters.eventTypes.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      </div>

      {/* Advanced Filters (Collapsible) */}
      {showAdvancedFilters && isExpanded && (
        <div className="p-4 pt-0 space-y-4 border-t border-gray-200">
          {/* User Selector with Autocomplete */}
          {availableUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Users
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value)
                    setShowUserDropdown(true)
                  }}
                  onFocus={() => setShowUserDropdown(true)}
                  placeholder="Search users..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {showUserDropdown && filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleUserSelect(user.id)}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-50 text-sm ${
                          filters.userIds?.includes(user.id) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        <div className="font-medium">{user.name}</div>
                        {user.email && (
                          <div className="text-xs text-gray-500">{user.email}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedUserNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUserNames.map((name, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                    >
                      {name}
                      <button
                        onClick={() => {
                          const userId = filters.userIds?.[index]
                          if (userId) handleUserSelect(userId)
                        }}
                        className="ml-1 hover:text-blue-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Entity Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entity Types
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableEntityTypes.map((entityType) => (
                <label
                  key={entityType}
                  className="flex items-center space-x-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.entityTypes?.includes(entityType) ?? false}
                    onChange={() => handleEntityTypeToggle(entityType)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{entityType}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Severity Filter (Radio Buttons) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Severity
            </label>
            <div className="grid grid-cols-2 gap-2">
              {SEVERITY_LEVELS.map((level) => (
                <label
                  key={level.value}
                  className={`flex items-center space-x-2 p-2 border rounded-md cursor-pointer transition-colors ${
                    filters.severity?.includes(level.value)
                      ? `${level.color} border-current`
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filters.severity?.includes(level.value) ?? false}
                    onChange={() => handleSeveritySelect(level.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">{level.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Category Filter (Checkboxes) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag className="h-4 w-4 inline mr-1" />
              Categories
            </label>
            <div className="space-y-2">
              {CATEGORIES.map((category) => {
                const Icon = category.icon
                return (
                  <label
                    key={category.value}
                    className="flex items-center space-x-2 p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.categories?.includes(category.value) ?? false}
                      onChange={() => handleCategoryToggle(category.value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Icon className="h-4 w-4 text-gray-600" />
                    <span className="text-sm text-gray-700">{category.label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Risk Level Filter (Checkboxes) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Level
            </label>
            <div className="grid grid-cols-2 gap-2">
              {RISK_LEVELS.map((level) => (
                <label
                  key={level.value}
                  className={`flex items-center space-x-2 p-2 border rounded-md cursor-pointer transition-colors ${
                    filters.riskLevels?.includes(level.value)
                      ? `${level.color} border-current`
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filters.riskLevels?.includes(level.value) ?? false}
                    onChange={() => handleRiskLevelToggle(level.value)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">{level.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Anomalies Only Filter */}
          <div>
            <label className="flex items-center space-x-2 p-3 border-2 border-red-200 rounded-md hover:bg-red-50 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showAnomaliesOnly ?? false}
                onChange={handleAnomaliesOnlyToggle}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-gray-900">Show Anomalies Only</span>
            </label>
          </div>
        </div>
      )}

      {/* Footer with Reset Button */}
      {hasActiveFilters && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleReset}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium flex items-center justify-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Clear All Filters</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default AuditFilters
