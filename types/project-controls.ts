/**
 * Types for project controls: work packages, ETC/EAC, earned value.
 */

export interface WorkPackage {
  id: string
  project_id: string
  name: string
  description: string | null
  budget: number
  start_date: string
  end_date: string
  percent_complete: number
  actual_cost: number
  earned_value: number
  responsible_manager: string
  parent_package_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WorkPackageCreate {
  project_id: string
  name: string
  description?: string | null
  budget: number
  start_date: string
  end_date: string
  responsible_manager: string
  parent_package_id?: string | null
}

export interface WorkPackageUpdate {
  name?: string
  description?: string | null
  budget?: number
  start_date?: string
  end_date?: string
  percent_complete?: number
  actual_cost?: number
  earned_value?: number
  responsible_manager?: string
  parent_package_id?: string | null
  is_active?: boolean
}

export interface WorkPackageSummary {
  work_package_count: number
  total_budget: number
  total_earned_value: number
  total_actual_cost: number
  average_percent_complete: number
}
