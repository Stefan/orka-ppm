/**
 * AuditFilters Component - Example Usage
 * 
 * This file demonstrates how to use the AuditFilters component
 * in your audit dashboard or timeline pages.
 */

'use client'

import React, { useState } from 'react'
import AuditFilters, { AuditFilters as AuditFiltersType, UserOption } from './AuditFilters'

/**
 * Example: Basic Usage
 */
export function BasicFilterExample() {
  const [filters, setFilters] = useState<AuditFiltersType>({
    dateRange: { start: null, end: null },
    eventTypes: [],
    severity: [],
    categories: [],
    riskLevels: [],
    showAnomaliesOnly: false
  })

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Basic Filter Example</h2>
      <AuditFilters
        filters={filters}
        onChange={setFilters}
      />
      
      {/* Display current filters */}
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Current Filters:</h3>
        <pre className="text-xs">{JSON.stringify(filters, null, 2)}</pre>
      </div>
    </div>
  )
}

/**
 * Example: With Custom Event Types
 */
export function CustomEventTypesExample() {
  const [filters, setFilters] = useState<AuditFiltersType>({
    dateRange: { start: null, end: null },
    eventTypes: [],
    severity: [],
    categories: [],
    riskLevels: [],
    showAnomaliesOnly: false
  })

  const customEventTypes = [
    'user_login',
    'user_logout',
    'budget_change',
    'permission_change',
    'resource_assignment',
    'project_created',
    'project_updated',
    'risk_created'
  ]

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Custom Event Types Example</h2>
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        availableEventTypes={customEventTypes}
      />
    </div>
  )
}

/**
 * Example: With User Autocomplete
 */
export function UserAutocompleteExample() {
  const [filters, setFilters] = useState<AuditFiltersType>({
    dateRange: { start: null, end: null },
    eventTypes: [],
    userIds: [],
    severity: [],
    categories: [],
    riskLevels: [],
    showAnomaliesOnly: false
  })

  const availableUsers: UserOption[] = [
    { id: '1', name: 'John Doe', email: 'john.doe@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane.smith@example.com' },
    { id: '3', name: 'Bob Johnson', email: 'bob.johnson@example.com' },
    { id: '4', name: 'Alice Williams', email: 'alice.williams@example.com' }
  ]

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">User Autocomplete Example</h2>
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        availableUsers={availableUsers}
        showAdvancedFilters={true}
      />
    </div>
  )
}

/**
 * Example: With All Options
 */
export function CompleteExample() {
  const [filters, setFilters] = useState<AuditFiltersType>({
    dateRange: { start: null, end: null },
    eventTypes: [],
    userIds: [],
    entityTypes: [],
    severity: [],
    categories: [],
    riskLevels: [],
    showAnomaliesOnly: false
  })

  const customEventTypes = [
    'user_login',
    'user_logout',
    'budget_change',
    'permission_change',
    'resource_assignment',
    'project_created',
    'project_updated',
    'risk_created',
    'risk_updated',
    'report_generated'
  ]

  const availableUsers: UserOption[] = [
    { id: '1', name: 'John Doe', email: 'john.doe@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane.smith@example.com' },
    { id: '3', name: 'Bob Johnson', email: 'bob.johnson@example.com' }
  ]

  const customEntityTypes = [
    'project',
    'resource',
    'risk',
    'change_request',
    'budget',
    'user',
    'report'
  ]

  // Handle filter changes and fetch data
  const handleFilterChange = (newFilters: AuditFiltersType) => {
    setFilters(newFilters)
    
    // Here you would typically fetch audit events based on the filters
    console.log('Filters changed:', newFilters)
    // fetchAuditEvents(newFilters)
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Complete Example with All Options</h2>
      <AuditFilters
        filters={filters}
        onChange={handleFilterChange}
        availableEventTypes={customEventTypes}
        availableUsers={availableUsers}
        availableEntityTypes={customEntityTypes}
        showAdvancedFilters={true}
      />
      
      {/* Display current filters */}
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Current Filters:</h3>
        <pre className="text-xs overflow-auto">{JSON.stringify(filters, null, 2)}</pre>
      </div>
    </div>
  )
}

/**
 * Example: Integration with Timeline Component
 */
export function TimelineIntegrationExample() {
  const [filters, setFilters] = useState<AuditFiltersType>({
    dateRange: { start: null, end: null },
    eventTypes: [],
    severity: [],
    categories: [],
    riskLevels: [],
    showAnomaliesOnly: false
  })

  // Simulated audit events (in real app, fetch from API)
  const [auditEvents, setAuditEvents] = useState([])

  const handleFilterChange = async (newFilters: AuditFiltersType) => {
    setFilters(newFilters)
    
    // Fetch audit events based on filters
    try {
      const queryParams = new URLSearchParams()
      
      if (newFilters.dateRange?.start) {
        queryParams.append('start_date', newFilters.dateRange.start.toISOString())
      }
      if (newFilters.dateRange?.end) {
        queryParams.append('end_date', newFilters.dateRange.end.toISOString())
      }
      if (newFilters.eventTypes && newFilters.eventTypes.length > 0) {
        queryParams.append('event_types', newFilters.eventTypes.join(','))
      }
      if (newFilters.severity && newFilters.severity.length > 0) {
        queryParams.append('severity', newFilters.severity.join(','))
      }
      if (newFilters.categories && newFilters.categories.length > 0) {
        queryParams.append('categories', newFilters.categories.join(','))
      }
      if (newFilters.riskLevels && newFilters.riskLevels.length > 0) {
        queryParams.append('risk_levels', newFilters.riskLevels.join(','))
      }
      if (newFilters.showAnomaliesOnly) {
        queryParams.append('anomalies_only', 'true')
      }
      
      // const response = await fetch(`/api/audit/events?${queryParams}`)
      // const data = await response.json()
      // setAuditEvents(data.events)
      
      console.log('Fetching audit events with filters:', queryParams.toString())
    } catch (error) {
      console.error('Error fetching audit events:', error)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Timeline Integration Example</h2>
      
      {/* Filters */}
      <AuditFilters
        filters={filters}
        onChange={handleFilterChange}
        showAdvancedFilters={true}
      />
      
      {/* Timeline would go here */}
      <div className="p-4 border border-gray-300 rounded-lg">
        <p className="text-gray-600">Timeline component would be rendered here with filtered events</p>
        <p className="text-sm text-gray-500 mt-2">
          Events count: {auditEvents.length}
        </p>
      </div>
    </div>
  )
}

/**
 * Example: Compact Mode (Without Advanced Filters)
 */
export function CompactModeExample() {
  const [filters, setFilters] = useState<AuditFiltersType>({
    dateRange: { start: null, end: null },
    eventTypes: [],
    severity: [],
    showAnomaliesOnly: false
  })

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Compact Mode Example</h2>
      <AuditFilters
        filters={filters}
        onChange={setFilters}
        showAdvancedFilters={false}
      />
    </div>
  )
}
