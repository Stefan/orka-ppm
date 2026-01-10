/**
 * Navigation types for SmartSidebar component
 */

import React from 'react'

export interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: number
  aiSuggested?: boolean
  usageFrequency?: number
  category?: 'primary' | 'secondary' | 'admin'
  description?: string
}

export interface UserNavigationPattern {
  userId: string
  itemId: string
  visitCount: number
  lastVisited: Date
  timeSpent: number
  contextualUsage: {
    timeOfDay: number // 0-23
    dayOfWeek: number // 0-6
    sessionDuration: number
  }
}

export interface AINavigationSuggestion {
  itemId: string
  confidence: number
  reason: 'frequent_use' | 'time_pattern' | 'workflow_completion' | 'role_based'
  message: string
}

export interface NavigationAnalytics {
  userId: string
  patterns: UserNavigationPattern[]
  suggestions: AINavigationSuggestion[]
  lastUpdated: Date
}