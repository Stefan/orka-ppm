// Vendor Scoring Logic
// Phase 3: Vendor performance analytics

import {
  Vendor,
  VendorScore,
  VendorMetrics,
  VendorRating,
  VendorWithMetrics,
  VendorPerformanceHistory,
  VendorProject,
  VendorFilter,
  VendorSortOption,
  VendorCategory,
  VendorStatus,
  VendorHistoryPoint,
  VENDOR_RATING_CONFIG
} from '@/types/vendor'

/**
 * Weight configuration for scoring
 */
const SCORE_WEIGHTS = {
  on_time_delivery: 0.35,
  cost_variance: 0.25,
  quality: 0.25,
  response_time: 0.15
}

/**
 * Calculate overall vendor score
 */
export function calculateVendorScore(metrics: VendorMetrics): number {
  // On-time delivery score (0-100)
  const onTimeScore = metrics.total_deliveries > 0
    ? ((metrics.total_deliveries - metrics.late_deliveries) / metrics.total_deliveries) * 100
    : 100
  
  // Cost variance score (100 = perfect, deduct points for variance)
  // Penalize positive variance (over budget) more than negative (under budget)
  const costScore = Math.max(0, 100 - Math.abs(metrics.avg_cost_variance) * (metrics.avg_cost_variance > 0 ? 2 : 1))
  
  // Quality score
  const qualityScore = metrics.avg_quality_rating * 20 // Convert 0-5 to 0-100
  
  // Response time score (faster is better, max 48 hours expected)
  const responseScore = Math.max(0, 100 - (metrics.avg_response_time_hours / 48) * 100)
  
  // Calculate weighted average
  const overallScore = 
    onTimeScore * SCORE_WEIGHTS.on_time_delivery +
    costScore * SCORE_WEIGHTS.cost_variance +
    qualityScore * SCORE_WEIGHTS.quality +
    responseScore * SCORE_WEIGHTS.response_time
  
  return Math.round(Math.max(0, Math.min(100, overallScore)) * 10) / 10
}

/**
 * Calculate on-time delivery rate
 */
export function calculateOnTimeDeliveryRate(
  totalDeliveries: number,
  lateDeliveries: number
): number {
  if (totalDeliveries <= 0) return 100
  return Math.round(((totalDeliveries - lateDeliveries) / totalDeliveries) * 1000) / 10
}

/**
 * Calculate cost variance from commitments and actuals
 */
export function calculateCostVariance(
  totalCommitted: number,
  totalActual: number
): number {
  if (totalCommitted <= 0) return 0
  return Math.round(((totalActual - totalCommitted) / totalCommitted) * 1000) / 10
}

/**
 * Get vendor rating based on score
 */
export function getVendorRating(score: number): VendorRating {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

/**
 * Get rating configuration
 */
export function getVendorRatingConfig(rating: VendorRating) {
  return VENDOR_RATING_CONFIG[rating]
}

/**
 * Get color classes for score display
 */
export function getScoreColorClass(score: number): string {
  if (score >= 90) return 'text-emerald-600'
  if (score >= 75) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * Get background color for score badge
 */
export function getScoreBgColorClass(score: number): string {
  if (score >= 90) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (score >= 75) return 'bg-green-100 text-green-700 border-green-200'
  if (score >= 60) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (score >= 40) return 'bg-orange-100 text-orange-700 border-orange-200'
  return 'bg-red-100 text-red-700 border-red-200'
}

/**
 * Analyze vendor performance trend
 */
export function analyzeVendorTrend(
  history: VendorHistoryPoint[]
): 'improving' | 'stable' | 'declining' {
  if (history.length < 2) return 'stable'
  
  // Get first and last 3 months averages
  const firstThree = history.slice(0, Math.min(3, history.length))
  const lastThree = history.slice(-Math.min(3, history.length))
  
  const firstAvg = firstThree.reduce((sum, h) => sum + h.overall_score, 0) / firstThree.length
  const lastAvg = lastThree.reduce((sum, h) => sum + h.overall_score, 0) / lastThree.length
  
  const change = lastAvg - firstAvg
  
  if (change > 5) return 'improving'
  if (change < -5) return 'declining'
  return 'stable'
}

/**
 * Filter vendors based on criteria
 */
export function filterVendors(
  vendors: VendorWithMetrics[],
  filter: VendorFilter
): VendorWithMetrics[] {
  return vendors.filter(vendor => {
    if (filter.status?.length && !filter.status.includes(vendor.status)) {
      return false
    }
    
    if (filter.category?.length && !filter.category.includes(vendor.category)) {
      return false
    }
    
    if (filter.rating?.length && !filter.rating.includes(vendor.score.rating)) {
      return false
    }
    
    if (filter.min_score !== undefined && vendor.score.overall_score < filter.min_score) {
      return false
    }
    
    if (filter.max_score !== undefined && vendor.score.overall_score > filter.max_score) {
      return false
    }
    
    if (filter.search) {
      const search = filter.search.toLowerCase()
      if (!vendor.name.toLowerCase().includes(search)) {
        return false
      }
    }
    
    return true
  })
}

/**
 * Sort vendors
 */
export function sortVendors(
  vendors: VendorWithMetrics[],
  sort: VendorSortOption
): VendorWithMetrics[] {
  const sorted = [...vendors]
  
  sorted.sort((a, b) => {
    let aVal: number | string
    let bVal: number | string
    
    switch (sort.field) {
      case 'name':
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        break
      case 'overall_score':
        aVal = a.score.overall_score
        bVal = b.score.overall_score
        break
      case 'on_time_delivery_rate':
        aVal = a.score.on_time_delivery_rate
        bVal = b.score.on_time_delivery_rate
        break
      case 'cost_variance':
        aVal = Math.abs(a.score.cost_variance_percentage)
        bVal = Math.abs(b.score.cost_variance_percentage)
        break
      case 'projects_completed':
        aVal = a.score.projects_completed
        bVal = b.score.projects_completed
        break
      default:
        aVal = a.name
        bVal = b.name
    }
    
    if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1
    if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1
    return 0
  })
  
  return sorted
}

/**
 * Format score for display
 */
export function formatScore(score: number): string {
  return score.toFixed(1)
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

// ============================================
// Mock Data for Development
// ============================================

const MOCK_VENDORS: VendorWithMetrics[] = [
  {
    id: 'vendor-001',
    name: 'TechPro Solutions',
    category: 'software',
    status: 'active',
    contact_email: 'contact@techpro.com',
    created_at: '2023-01-15T00:00:00Z',
    updated_at: '2024-06-01T00:00:00Z',
    score: {
      vendor_id: 'vendor-001',
      vendor_name: 'TechPro Solutions',
      on_time_delivery_rate: 95,
      cost_variance_percentage: -2.5,
      quality_score: 92,
      response_time_score: 88,
      overall_score: 92.3,
      rating: 'A',
      projects_completed: 12,
      total_contract_value: 450000,
      last_updated: '2024-06-01T00:00:00Z'
    },
    metrics: {
      vendor_id: 'vendor-001',
      avg_delivery_days: 28,
      delivery_std_dev: 3.2,
      avg_cost_variance: -2.5,
      late_deliveries: 1,
      total_deliveries: 20,
      avg_quality_rating: 4.6,
      quality_issues: 2,
      avg_response_time_hours: 4.5
    },
    projects: [
      {
        project_id: 'proj-001',
        project_name: 'Website Redesign',
        contract_value: 75000,
        actual_cost: 72000,
        variance: 3000,
        start_date: '2024-01-01',
        end_date: '2024-03-31',
        status: 'completed',
        on_time: true,
        quality_rating: 4.8
      },
      {
        project_id: 'proj-002',
        project_name: 'Mobile App Development',
        contract_value: 120000,
        actual_cost: 118000,
        variance: 2000,
        start_date: '2024-02-01',
        end_date: '2024-07-31',
        status: 'in_progress',
        on_time: true
      }
    ]
  },
  {
    id: 'vendor-002',
    name: 'BuildRight Construction',
    category: 'services',
    status: 'active',
    contact_email: 'info@buildright.com',
    created_at: '2022-06-01T00:00:00Z',
    updated_at: '2024-05-15T00:00:00Z',
    score: {
      vendor_id: 'vendor-002',
      vendor_name: 'BuildRight Construction',
      on_time_delivery_rate: 78,
      cost_variance_percentage: 8.5,
      quality_score: 75,
      response_time_score: 70,
      overall_score: 75.8,
      rating: 'B',
      projects_completed: 8,
      total_contract_value: 890000,
      last_updated: '2024-05-15T00:00:00Z'
    },
    metrics: {
      vendor_id: 'vendor-002',
      avg_delivery_days: 45,
      delivery_std_dev: 8.5,
      avg_cost_variance: 8.5,
      late_deliveries: 4,
      total_deliveries: 18,
      avg_quality_rating: 3.8,
      quality_issues: 5,
      avg_response_time_hours: 12.0
    }
  },
  {
    id: 'vendor-003',
    name: 'Global Materials Inc',
    category: 'materials',
    status: 'active',
    contact_email: 'sales@globalmaterials.com',
    created_at: '2021-03-10T00:00:00Z',
    updated_at: '2024-06-10T00:00:00Z',
    score: {
      vendor_id: 'vendor-003',
      vendor_name: 'Global Materials Inc',
      on_time_delivery_rate: 88,
      cost_variance_percentage: 3.2,
      quality_score: 85,
      response_time_score: 92,
      overall_score: 87.1,
      rating: 'B',
      projects_completed: 25,
      total_contract_value: 1250000,
      last_updated: '2024-06-10T00:00:00Z'
    },
    metrics: {
      vendor_id: 'vendor-003',
      avg_delivery_days: 14,
      delivery_std_dev: 2.1,
      avg_cost_variance: 3.2,
      late_deliveries: 6,
      total_deliveries: 50,
      avg_quality_rating: 4.3,
      quality_issues: 3,
      avg_response_time_hours: 2.5
    }
  },
  {
    id: 'vendor-004',
    name: 'ConsultCorp Advisory',
    category: 'consulting',
    status: 'active',
    contact_email: 'advisors@consultcorp.com',
    created_at: '2023-09-01T00:00:00Z',
    updated_at: '2024-04-20T00:00:00Z',
    score: {
      vendor_id: 'vendor-004',
      vendor_name: 'ConsultCorp Advisory',
      on_time_delivery_rate: 100,
      cost_variance_percentage: 15.0,
      quality_score: 88,
      response_time_score: 95,
      overall_score: 68.5,
      rating: 'C',
      projects_completed: 5,
      total_contract_value: 320000,
      last_updated: '2024-04-20T00:00:00Z'
    },
    metrics: {
      vendor_id: 'vendor-004',
      avg_delivery_days: 21,
      delivery_std_dev: 0,
      avg_cost_variance: 15.0,
      late_deliveries: 0,
      total_deliveries: 8,
      avg_quality_rating: 4.4,
      quality_issues: 1,
      avg_response_time_hours: 1.5
    }
  },
  {
    id: 'vendor-005',
    name: 'QuickEquip Rentals',
    category: 'equipment',
    status: 'active',
    contact_email: 'rentals@quickequip.com',
    created_at: '2020-11-15T00:00:00Z',
    updated_at: '2024-05-30T00:00:00Z',
    score: {
      vendor_id: 'vendor-005',
      vendor_name: 'QuickEquip Rentals',
      on_time_delivery_rate: 55,
      cost_variance_percentage: -5.0,
      quality_score: 60,
      response_time_score: 45,
      overall_score: 52.3,
      rating: 'D',
      projects_completed: 15,
      total_contract_value: 280000,
      last_updated: '2024-05-30T00:00:00Z'
    },
    metrics: {
      vendor_id: 'vendor-005',
      avg_delivery_days: 7,
      delivery_std_dev: 5.0,
      avg_cost_variance: -5.0,
      late_deliveries: 9,
      total_deliveries: 20,
      avg_quality_rating: 3.0,
      quality_issues: 8,
      avg_response_time_hours: 24.0
    }
  },
  {
    id: 'vendor-006',
    name: 'ValueSource Supplies',
    category: 'materials',
    status: 'suspended',
    contact_email: 'orders@valuesource.com',
    created_at: '2022-02-20T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z',
    score: {
      vendor_id: 'vendor-006',
      vendor_name: 'ValueSource Supplies',
      on_time_delivery_rate: 35,
      cost_variance_percentage: 25.0,
      quality_score: 40,
      response_time_score: 30,
      overall_score: 32.5,
      rating: 'F',
      projects_completed: 3,
      total_contract_value: 95000,
      last_updated: '2024-03-01T00:00:00Z'
    },
    metrics: {
      vendor_id: 'vendor-006',
      avg_delivery_days: 35,
      delivery_std_dev: 15.0,
      avg_cost_variance: 25.0,
      late_deliveries: 13,
      total_deliveries: 20,
      avg_quality_rating: 2.0,
      quality_issues: 12,
      avg_response_time_hours: 72.0
    }
  }
]

/**
 * Fetch all vendors with their scores
 */
export async function fetchVendors(
  filter?: VendorFilter,
  sort?: VendorSortOption
): Promise<VendorWithMetrics[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 200))
  
  let vendors = [...MOCK_VENDORS]
  
  if (filter) {
    vendors = filterVendors(vendors, filter)
  }
  
  if (sort) {
    vendors = sortVendors(vendors, sort)
  }
  
  return vendors
}

/**
 * Fetch a single vendor by ID
 */
export async function fetchVendorById(vendorId: string): Promise<VendorWithMetrics | null> {
  await new Promise(resolve => setTimeout(resolve, 100))
  return MOCK_VENDORS.find(v => v.id === vendorId) || null
}

/**
 * Fetch vendor performance history
 */
export async function fetchVendorHistory(
  vendorId: string,
  months: number = 12
): Promise<VendorPerformanceHistory | null> {
  await new Promise(resolve => setTimeout(resolve, 150))
  
  const vendor = MOCK_VENDORS.find(v => v.id === vendorId)
  if (!vendor) return null
  
  // Generate mock history
  const history: VendorHistoryPoint[] = []
  const now = new Date()
  
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setMonth(date.getMonth() - i)
    
    // Add some variance to create realistic-looking history
    const baseScore = vendor.score.overall_score
    const variance = (Math.random() - 0.5) * 10
    
    history.push({
      date: date.toISOString(),
      overall_score: Math.max(0, Math.min(100, baseScore + variance)),
      on_time_delivery_rate: Math.max(0, Math.min(100, vendor.score.on_time_delivery_rate + (Math.random() - 0.5) * 15)),
      cost_variance_percentage: vendor.score.cost_variance_percentage + (Math.random() - 0.5) * 5,
      quality_score: Math.max(0, Math.min(100, vendor.score.quality_score + (Math.random() - 0.5) * 10))
    })
  }
  
  const trend = analyzeVendorTrend(history)
  const last12Avg = history.reduce((sum, h) => sum + h.overall_score, 0) / history.length
  
  return {
    vendor_id: vendorId,
    vendor_name: vendor.name,
    history,
    trend,
    last_12_months_avg: Math.round(last12Avg * 10) / 10,
    year_over_year_change: Math.round((history[history.length - 1].overall_score - history[0].overall_score) * 10) / 10
  }
}

/**
 * Get vendor statistics summary
 */
export async function getVendorStats(): Promise<{
  total: number
  byRating: Record<VendorRating, number>
  avgScore: number
  topPerformer: VendorWithMetrics | null
}> {
  const vendors = await fetchVendors()
  
  const byRating: Record<VendorRating, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  let totalScore = 0
  
  for (const vendor of vendors) {
    byRating[vendor.score.rating]++
    totalScore += vendor.score.overall_score
  }
  
  const avgScore = vendors.length > 0 ? totalScore / vendors.length : 0
  const topPerformer = vendors.reduce((best, v) => 
    v.score.overall_score > (best?.score.overall_score || 0) ? v : best
  , null as VendorWithMetrics | null)
  
  return {
    total: vendors.length,
    byRating,
    avgScore: Math.round(avgScore * 10) / 10,
    topPerformer
  }
}

export default fetchVendors
