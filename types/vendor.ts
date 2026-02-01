// Vendor Score Card Type Definitions
// Phase 3: Vendor performance analytics

import { Currency } from './costbook'

/**
 * Vendor rating based on overall score
 */
export type VendorRating = 'A' | 'B' | 'C' | 'D' | 'F'

/**
 * Vendor status
 */
export type VendorStatus = 'active' | 'inactive' | 'pending' | 'suspended'

/**
 * Vendor category
 */
export type VendorCategory = 
  | 'services' 
  | 'materials' 
  | 'equipment' 
  | 'consulting' 
  | 'software' 
  | 'other'

/**
 * Core vendor information
 */
export interface Vendor {
  id: string
  name: string
  category: VendorCategory
  status: VendorStatus
  contact_email?: string
  contact_phone?: string
  address?: string
  created_at: string
  updated_at: string
}

/**
 * Vendor score metrics
 */
export interface VendorScore {
  vendor_id: string
  vendor_name: string
  /** On-time delivery rate (0-100) */
  on_time_delivery_rate: number
  /** Cost variance percentage (can be negative or positive) */
  cost_variance_percentage: number
  /** Quality score (0-100) */
  quality_score: number
  /** Response time score (0-100) */
  response_time_score: number
  /** Overall score (0-100) */
  overall_score: number
  /** Letter rating */
  rating: VendorRating
  /** Number of projects completed */
  projects_completed: number
  /** Total contract value */
  total_contract_value: number
  /** Last evaluation date */
  last_updated: string
}

/**
 * Vendor performance metrics over time
 */
export interface VendorMetrics {
  vendor_id: string
  /** Average days to deliver */
  avg_delivery_days: number
  /** Standard deviation of delivery days */
  delivery_std_dev: number
  /** Average cost variance */
  avg_cost_variance: number
  /** Number of late deliveries */
  late_deliveries: number
  /** Number of total deliveries */
  total_deliveries: number
  /** Average quality rating from reviews */
  avg_quality_rating: number
  /** Number of quality issues reported */
  quality_issues: number
  /** Average response time in hours */
  avg_response_time_hours: number
}

/**
 * Vendor performance history point
 */
export interface VendorHistoryPoint {
  date: string
  overall_score: number
  on_time_delivery_rate: number
  cost_variance_percentage: number
  quality_score: number
}

/**
 * Vendor performance history
 */
export interface VendorPerformanceHistory {
  vendor_id: string
  vendor_name: string
  history: VendorHistoryPoint[]
  trend: 'improving' | 'stable' | 'declining'
  last_12_months_avg: number
  year_over_year_change: number
}

/**
 * Vendor project association
 */
export interface VendorProject {
  project_id: string
  project_name: string
  contract_value: number
  actual_cost: number
  variance: number
  start_date: string
  end_date: string
  status: 'in_progress' | 'completed' | 'cancelled'
  on_time: boolean
  quality_rating?: number
}

/**
 * Extended vendor with all metrics and history
 */
export interface VendorWithMetrics extends Vendor {
  score: VendorScore
  metrics: VendorMetrics
  performance_history?: VendorPerformanceHistory
  projects?: VendorProject[]
}

/**
 * Vendor filter options
 */
export interface VendorFilter {
  status?: VendorStatus[]
  category?: VendorCategory[]
  rating?: VendorRating[]
  min_score?: number
  max_score?: number
  search?: string
}

/**
 * Vendor sort options
 */
export interface VendorSortOption {
  field: 'name' | 'overall_score' | 'on_time_delivery_rate' | 'cost_variance' | 'projects_completed'
  direction: 'asc' | 'desc'
}

/**
 * Rating configuration for UI
 */
export interface VendorRatingConfig {
  rating: VendorRating
  label: string
  color: string
  bgColor: string
  minScore: number
  maxScore: number
  description: string
}

/**
 * Rating configurations
 */
export const VENDOR_RATING_CONFIG: Record<VendorRating, VendorRatingConfig> = {
  A: {
    rating: 'A',
    label: 'Excellent',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    minScore: 90,
    maxScore: 100,
    description: 'Top-tier vendor with exceptional performance'
  },
  B: {
    rating: 'B',
    label: 'Good',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    minScore: 75,
    maxScore: 89,
    description: 'Reliable vendor meeting expectations'
  },
  C: {
    rating: 'C',
    label: 'Average',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    minScore: 60,
    maxScore: 74,
    description: 'Satisfactory but with room for improvement'
  },
  D: {
    rating: 'D',
    label: 'Below Average',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    minScore: 40,
    maxScore: 59,
    description: 'Performance concerns requiring monitoring'
  },
  F: {
    rating: 'F',
    label: 'Poor',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    minScore: 0,
    maxScore: 39,
    description: 'Significant issues - consider alternatives'
  }
}

/**
 * Category icons/labels
 */
export const VENDOR_CATEGORY_CONFIG: Record<VendorCategory, { label: string; icon: string }> = {
  services: { label: 'Services', icon: 'Wrench' },
  materials: { label: 'Materials', icon: 'Package' },
  equipment: { label: 'Equipment', icon: 'Truck' },
  consulting: { label: 'Consulting', icon: 'Users' },
  software: { label: 'Software', icon: 'Code' },
  other: { label: 'Other', icon: 'MoreHorizontal' }
}
