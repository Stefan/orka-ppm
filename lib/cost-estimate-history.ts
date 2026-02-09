// Cost Estimate History Tracking
// Phase 3: Track and analyze cost estimate changes over time

import { Currency } from '@/types/costbook'

/**
 * Types of estimate changes
 */
export type EstimateChangeType =
  | 'initial'
  | 'scope_change'
  | 're_estimate'
  | 'contingency_adjustment'
  | 'market_adjustment'
  | 'risk_adjustment'
  | 'correction'
  | 'approval'

/**
 * Estimate change reason categories
 */
export type ChangeReason =
  | 'scope_increase'
  | 'scope_decrease'
  | 'price_increase'
  | 'price_decrease'
  | 'schedule_change'
  | 'risk_mitigation'
  | 'market_conditions'
  | 'vendor_negotiation'
  | 'regulatory_change'
  | 'other'

/**
 * A single cost estimate snapshot
 */
export interface CostEstimateSnapshot {
  id: string
  project_id: string
  estimate_value: number
  currency: Currency
  estimate_date: string
  change_type: EstimateChangeType
  change_reason?: ChangeReason
  change_amount: number
  change_percentage: number
  description: string
  approved_by?: string
  approved_at?: string
  is_baseline?: boolean
  confidence_level?: number
  notes?: string
}

/**
 * Cost estimate history for a project
 */
export interface CostEstimateHistory {
  project_id: string
  project_name: string
  current_estimate: number
  original_estimate: number
  baseline_estimate: number
  total_change: number
  total_change_percentage: number
  snapshots: CostEstimateSnapshot[]
  trend: 'increasing' | 'stable' | 'decreasing'
  last_updated: string
}

/**
 * Summary statistics for estimates
 */
export interface EstimateSummary {
  original: number
  current: number
  baseline: number
  variance_from_original: number
  variance_from_baseline: number
  number_of_revisions: number
  avg_revision_amount: number
  largest_increase: number
  largest_decrease: number
}

/**
 * Estimate change configuration for UI
 */
export interface EstimateChangeConfig {
  type: EstimateChangeType
  label: string
  color: string
  bgColor: string
  icon: string
}

/**
 * Change type configurations
 */
export const ESTIMATE_CHANGE_CONFIG: Record<EstimateChangeType, EstimateChangeConfig> = {
  initial: {
    type: 'initial',
    label: 'Initial Estimate',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'FileText'
  },
  scope_change: {
    type: 'scope_change',
    label: 'Scope Change',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: 'Expand'
  },
  re_estimate: {
    type: 're_estimate',
    label: 'Re-estimate',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: 'RefreshCw'
  },
  contingency_adjustment: {
    type: 'contingency_adjustment',
    label: 'Contingency Adjustment',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: 'Shield'
  },
  market_adjustment: {
    type: 'market_adjustment',
    label: 'Market Adjustment',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-100',
    icon: 'TrendingUp'
  },
  risk_adjustment: {
    type: 'risk_adjustment',
    label: 'Risk Adjustment',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: 'AlertTriangle'
  },
  correction: {
    type: 'correction',
    label: 'Correction',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    icon: 'Edit'
  },
  approval: {
    type: 'approval',
    label: 'Approval',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: 'CheckCircle'
  }
}

/**
 * Change reason labels
 */
export const CHANGE_REASON_LABELS: Record<ChangeReason, string> = {
  scope_increase: 'Scope Increase',
  scope_decrease: 'Scope Decrease',
  price_increase: 'Price Increase',
  price_decrease: 'Price Decrease',
  schedule_change: 'Schedule Change',
  risk_mitigation: 'Risk Mitigation',
  market_conditions: 'Market Conditions',
  vendor_negotiation: 'Vendor Negotiation',
  regulatory_change: 'Regulatory Change',
  other: 'Other'
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calculate change percentage
 */
export function calculateChangePercentage(
  previousValue: number,
  newValue: number
): number {
  if (previousValue === 0) return 0
  return Math.round(((newValue - previousValue) / previousValue) * 1000) / 10
}

/**
 * Analyze estimate trend
 */
export function analyzeEstimateTrend(
  snapshots: CostEstimateSnapshot[]
): 'increasing' | 'stable' | 'decreasing' {
  if (snapshots.length < 2) return 'stable'
  
  // Look at last few changes
  const recentChanges = snapshots.slice(-3)
  const totalChange = recentChanges.reduce((sum, s) => sum + s.change_amount, 0)
  const avgChange = totalChange / recentChanges.length
  
  // Calculate threshold as 2% of current estimate
  const currentEstimate = snapshots[snapshots.length - 1].estimate_value
  const threshold = currentEstimate * 0.02
  
  if (avgChange > threshold) return 'increasing'
  if (avgChange < -threshold) return 'decreasing'
  return 'stable'
}

/**
 * Calculate estimate summary statistics
 */
export function calculateEstimateSummary(history: CostEstimateHistory): EstimateSummary {
  const { snapshots, original_estimate, current_estimate, baseline_estimate } = history
  
  const changes = snapshots.filter(s => s.change_type !== 'initial')
  
  let largestIncrease = 0
  let largestDecrease = 0
  
  for (const snapshot of changes) {
    if (snapshot.change_amount > largestIncrease) {
      largestIncrease = snapshot.change_amount
    }
    if (snapshot.change_amount < largestDecrease) {
      largestDecrease = snapshot.change_amount
    }
  }
  
  const totalChangeAmount = changes.reduce((sum, s) => sum + Math.abs(s.change_amount), 0)
  
  return {
    original: original_estimate,
    current: current_estimate,
    baseline: baseline_estimate,
    variance_from_original: current_estimate - original_estimate,
    variance_from_baseline: current_estimate - baseline_estimate,
    number_of_revisions: changes.length,
    avg_revision_amount: changes.length > 0 ? totalChangeAmount / changes.length : 0,
    largest_increase: largestIncrease,
    largest_decrease: largestDecrease
  }
}

/**
 * Format currency for display
 */
export function formatEstimateCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

/**
 * Format change for display
 */
export function formatChange(value: number): string {
  const prefix = value >= 0 ? '+' : ''
  return prefix + formatEstimateCurrency(value)
}

// ============================================
// Mock Data and Service Functions
// ============================================

const MOCK_HISTORY: Map<string, CostEstimateHistory> = new Map()

// Initialize mock data
function initializeMockData() {
  const mockProjects = ['proj-001', 'proj-002', 'proj-003']
  
  mockProjects.forEach((projectId, idx) => {
    const originalEstimate = 500000 + idx * 200000
    const snapshots: CostEstimateSnapshot[] = []
    
    // Initial estimate
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 12)
    
    snapshots.push({
      id: generateId(),
      project_id: projectId,
      estimate_value: originalEstimate,
      currency: Currency.USD,
      estimate_date: startDate.toISOString(),
      change_type: 'initial',
      change_amount: 0,
      change_percentage: 0,
      description: 'Initial project estimate based on preliminary scope',
      is_baseline: true,
      confidence_level: 70
    })
    
    // Simulate several changes
    const changes: Array<{
      monthsAgo: number
      type: EstimateChangeType
      reason?: ChangeReason
      changePercent: number
      description: string
      approved: boolean
    }> = [
      {
        monthsAgo: 10,
        type: 'approval',
        changePercent: 0,
        description: 'Baseline estimate approved by steering committee',
        approved: true
      },
      {
        monthsAgo: 8,
        type: 'scope_change',
        reason: 'scope_increase',
        changePercent: 8 + idx * 2,
        description: 'Additional features requested by stakeholders',
        approved: true
      },
      {
        monthsAgo: 6,
        type: 'market_adjustment',
        reason: 'price_increase',
        changePercent: 3,
        description: 'Material cost increases due to market conditions',
        approved: true
      },
      {
        monthsAgo: 4,
        type: 're_estimate',
        reason: 'other',
        changePercent: -2,
        description: 'Refined estimate after detailed design phase',
        approved: true
      },
      {
        monthsAgo: 2,
        type: 'risk_adjustment',
        reason: 'risk_mitigation',
        changePercent: 5,
        description: 'Added contingency for identified risks',
        approved: true
      },
      {
        monthsAgo: 1,
        type: 'contingency_adjustment',
        reason: 'vendor_negotiation',
        changePercent: -1.5,
        description: 'Reduced contingency after vendor negotiations',
        approved: false
      }
    ]
    
    let currentEstimate = originalEstimate
    
    changes.forEach(change => {
      const date = new Date()
      date.setMonth(date.getMonth() - change.monthsAgo)
      
      const changeAmount = Math.round(currentEstimate * (change.changePercent / 100))
      const newEstimate = currentEstimate + changeAmount
      
      snapshots.push({
        id: generateId(),
        project_id: projectId,
        estimate_value: newEstimate,
        currency: Currency.USD,
        estimate_date: date.toISOString(),
        change_type: change.type,
        change_reason: change.reason,
        change_amount: changeAmount,
        change_percentage: change.changePercent,
        description: change.description,
        approved_by: change.approved ? 'Project Manager' : undefined,
        approved_at: change.approved ? date.toISOString() : undefined,
        confidence_level: 70 + Math.random() * 20
      })
      
      currentEstimate = newEstimate
    })
    
    const history: CostEstimateHistory = {
      project_id: projectId,
      project_name: `Project ${idx + 1}`,
      current_estimate: currentEstimate,
      original_estimate: originalEstimate,
      baseline_estimate: originalEstimate,
      total_change: currentEstimate - originalEstimate,
      total_change_percentage: calculateChangePercentage(originalEstimate, currentEstimate),
      snapshots,
      trend: analyzeEstimateTrend(snapshots),
      last_updated: snapshots[snapshots.length - 1].estimate_date
    }
    
    MOCK_HISTORY.set(projectId, history)
  })
}

// Initialize on module load
initializeMockData()

/**
 * Fetch cost estimate history for a project
 */
export async function fetchEstimateHistory(
  projectId: string
): Promise<CostEstimateHistory | null> {
  await new Promise(resolve => setTimeout(resolve, 200))
  return MOCK_HISTORY.get(projectId) || null
}

/**
 * Fetch estimate histories for multiple projects
 */
export async function fetchEstimateHistories(
  projectIds: string[]
): Promise<CostEstimateHistory[]> {
  await new Promise(resolve => setTimeout(resolve, 200))
  
  return projectIds
    .map(id => MOCK_HISTORY.get(id))
    .filter((h): h is CostEstimateHistory => h !== undefined)
}

/**
 * Add a new estimate snapshot
 */
export async function addEstimateSnapshot(
  projectId: string,
  newValue: number,
  changeType: EstimateChangeType,
  description: string,
  options?: {
    changeReason?: ChangeReason
    notes?: string
    confidenceLevel?: number
  }
): Promise<CostEstimateSnapshot> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const history = MOCK_HISTORY.get(projectId)
  if (!history) {
    throw new Error('Project not found')
  }
  
  const currentEstimate = history.current_estimate
  const changeAmount = newValue - currentEstimate
  const changePercentage = calculateChangePercentage(currentEstimate, newValue)
  
  const snapshot: CostEstimateSnapshot = {
    id: generateId(),
    project_id: projectId,
    estimate_value: newValue,
    currency: Currency.USD,
    estimate_date: new Date().toISOString(),
    change_type: changeType,
    change_reason: options?.changeReason,
    change_amount: changeAmount,
    change_percentage: changePercentage,
    description,
    confidence_level: options?.confidenceLevel,
    notes: options?.notes
  }
  
  history.snapshots.push(snapshot)
  history.current_estimate = newValue
  history.total_change = newValue - history.original_estimate
  history.total_change_percentage = calculateChangePercentage(
    history.original_estimate,
    newValue
  )
  history.trend = analyzeEstimateTrend(history.snapshots)
  history.last_updated = snapshot.estimate_date
  
  return snapshot
}

/**
 * Set a snapshot as baseline
 */
export async function setBaseline(
  projectId: string,
  snapshotId: string
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const history = MOCK_HISTORY.get(projectId)
  if (!history) {
    throw new Error('Project not found')
  }
  
  // Remove baseline from all snapshots
  history.snapshots.forEach(s => {
    s.is_baseline = false
  })
  
  // Set new baseline
  const snapshot = history.snapshots.find(s => s.id === snapshotId)
  if (snapshot) {
    snapshot.is_baseline = true
    history.baseline_estimate = snapshot.estimate_value
  }
}

/**
 * Approve a snapshot
 */
export async function approveSnapshot(
  projectId: string,
  snapshotId: string,
  approverName: string
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const history = MOCK_HISTORY.get(projectId)
  if (!history) {
    throw new Error('Project not found')
  }
  
  const snapshot = history.snapshots.find(s => s.id === snapshotId)
  if (snapshot) {
    snapshot.approved_by = approverName
    snapshot.approved_at = new Date().toISOString()
  }
}

export default fetchEstimateHistory
