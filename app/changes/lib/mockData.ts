/**
 * Comprehensive mock data for Change Management System
 * Provides complete data structures for optimal component rendering
 */

export interface ChangeRequest {
  id: string
  change_number: string
  title: string
  description: string
  justification: string
  change_type: 'scope' | 'schedule' | 'budget' | 'design' | 'regulatory' | 'resource' | 'quality' | 'safety' | 'emergency'
  priority: 'low' | 'medium' | 'high' | 'critical' | 'emergency'
  status: 'draft' | 'submitted' | 'under_review' | 'pending_approval' | 'approved' | 'rejected' | 'on_hold' | 'implementing' | 'implemented' | 'closed' | 'cancelled'
  
  // Requestor information
  requested_by: string
  requested_date: string
  required_by_date?: string
  
  // Project linkage
  project_id: string
  project_name: string
  affected_milestones: Array<{ id: string; name: string; impact_description?: string }>
  affected_pos: Array<{ id: string; number: string; description: string; impact_amount?: number }>
  
  // Impact data
  estimated_cost_impact?: number
  estimated_schedule_impact_days?: number
  actual_cost_impact?: number
  actual_schedule_impact_days?: number
  
  // Implementation tracking
  implementation_progress?: number
  implementation_start_date?: string
  implementation_end_date?: string
  
  // Approval workflow
  pending_approvals: Array<{
    id: string
    approver_name: string
    approver_role: string
    step_number: number
    due_date: string
    status: 'pending' | 'waiting' | 'overdue'
    escalated?: boolean
  }>
  
  approval_history: Array<{
    id: string
    approver_name: string
    approver_role: string
    decision: 'approved' | 'rejected' | 'needs_info' | 'delegated'
    decision_date: string
    comments: string
    conditions?: string
  }>
  
  // Metadata
  version: number
  created_at: string
  updated_at: string
  closed_at?: string
  
  // Documents and communications
  attachments: Array<{
    id: string
    filename: string
    size: number
    uploaded_by: string
    uploaded_at: string
    file_type: string
    download_url?: string
  }>
  
  communications: Array<{
    id: string
    type: 'comment' | 'status_change' | 'approval' | 'rejection' | 'escalation' | 'notification'
    message: string
    author: string
    timestamp: string
    metadata?: Record<string, any>
  }>
}

export interface ImpactAnalysisData {
  changeId: string
  
  // Schedule impact
  critical_path_affected: boolean
  schedule_impact_days: number
  affected_activities: Array<{
    id: string
    name: string
    original_duration: number
    new_duration: number
    delay_days: number
    resource_impact: string
  }>
  
  // Cost impact
  total_cost_impact: number
  direct_costs: number
  indirect_costs: number
  cost_savings: number
  cost_breakdown: {
    materials: number
    labor: number
    equipment: number
    overhead: number
    contingency: number
  }
  
  // Resource impact
  additional_resources_needed: Array<{
    resource_type: string
    quantity: number
    duration_days: number
    cost_per_unit: number
    total_cost: number
  }>
  
  resource_reallocation: Array<{
    from_activity: string
    to_activity: string
    resource_type: string
    quantity: number
    impact_description: string
  }>
  
  // Risk impact
  new_risks: Array<{
    id: string
    description: string
    probability: number
    impact_score: number
    mitigation_cost: number
    category: string
  }>
  
  modified_risks: Array<{
    id: string
    description: string
    old_probability: number
    new_probability: number
    old_impact: number
    new_impact: number
    change_reason: string
  }>
  
  // Scenarios
  scenarios: {
    best_case: {
      cost_impact: number
      schedule_impact: number
      probability: number
      description: string
    }
    worst_case: {
      cost_impact: number
      schedule_impact: number
      probability: number
      description: string
    }
    most_likely: {
      cost_impact: number
      schedule_impact: number
      probability: number
      description: string
    }
  }
  
  analyzed_by: string
  analyzed_at: string
  approved_by?: string
  approved_at?: string
}

export interface ChangeAnalytics {
  total_changes: number
  changes_by_status: Record<string, number>
  changes_by_type: Record<string, number>
  changes_by_priority: Record<string, number>
  
  // Performance metrics
  average_approval_time_days: number
  average_implementation_time_days: number
  approval_rate_percentage: number
  
  // Impact accuracy
  cost_estimate_accuracy: number
  schedule_estimate_accuracy: number
  
  // Trends
  monthly_change_volume: Array<{
    month: string
    approved_changes: number
    rejected_changes: number
    total_changes: number
    average_approval_time: number
  }>
  
  top_change_categories: Array<{
    category: string
    count: number
    percentage: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }>
  
  // Project-specific metrics
  changes_by_project: Array<{
    project_id: string
    project_name: string
    count: number
    approval_rate: number
    average_cost_impact: number
  }>
  
  high_impact_changes: Array<{
    id: string
    title: string
    impact_score: number
    cost_impact: number
    schedule_impact: number
    status: string
  }>
  
  // Performance indicators
  bottlenecks: Array<{
    stage: string
    average_delay_days: number
    frequency: number
    suggested_actions: string[]
  }>
  
  efficiency_metrics: {
    changes_per_project: number
    cost_per_change: number
    time_to_approval: number
    implementation_success_rate: number
  }
}

// Mock data generators
export const generateMockChangeRequest = (overrides: Partial<ChangeRequest> = {}): ChangeRequest => ({
  id: 'cr-001',
  change_number: 'CR-2024-0001',
  title: 'Foundation Design Modification',
  description: 'Update foundation design due to unexpected soil conditions discovered during site investigation. The current design assumes standard soil bearing capacity, but geotechnical analysis reveals the need for deeper foundations with additional reinforcement.',
  justification: 'Geotechnical report indicates soil bearing capacity is 30% lower than initially assumed. Without this change, structural integrity could be compromised, leading to potential safety issues and costly remediation later.',
  change_type: 'design',
  priority: 'high',
  status: 'pending_approval',
  
  requested_by: 'John Smith',
  requested_date: '2024-01-15T10:30:00Z',
  required_by_date: '2024-02-01',
  
  project_id: 'proj-1',
  project_name: 'Office Complex Phase 1',
  affected_milestones: [
    { id: 'ms-1', name: 'Foundation Complete', impact_description: 'Delayed by 14 days due to design changes' },
    { id: 'ms-2', name: 'Structure Complete', impact_description: 'Potential 7-day delay if foundation work extends' }
  ],
  affected_pos: [
    { id: 'po-1', number: 'PO-2024-001', description: 'Concrete Supply', impact_amount: 15000 },
    { id: 'po-2', number: 'PO-2024-003', description: 'Foundation Materials', impact_amount: 10000 }
  ],
  
  estimated_cost_impact: 25000,
  estimated_schedule_impact_days: 14,
  
  implementation_progress: 0,
  
  pending_approvals: [
    {
      id: 'app-1',
      approver_name: 'Sarah Johnson',
      approver_role: 'Project Manager',
      step_number: 1,
      due_date: '2024-01-22T17:00:00Z',
      status: 'pending',
      escalated: false
    },
    {
      id: 'app-2',
      approver_name: 'Mike Davis',
      approver_role: 'Engineering Director',
      step_number: 2,
      due_date: '2024-01-25T17:00:00Z',
      status: 'waiting',
      escalated: false
    }
  ],
  
  approval_history: [
    {
      id: 'hist-1',
      approver_name: 'Technical Review Team',
      approver_role: 'Technical Reviewer',
      decision: 'approved',
      decision_date: '2024-01-16T14:20:00Z',
      comments: 'Technical review completed. Design changes are sound and necessary for structural integrity.'
    }
  ],
  
  version: 1,
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-01-16T14:20:00Z',
  
  attachments: [
    {
      id: 'att-1',
      filename: 'Geotechnical_Report_Rev2.pdf',
      size: 2048576,
      uploaded_by: 'John Smith',
      uploaded_at: '2024-01-15T10:35:00Z',
      file_type: 'application/pdf'
    },
    {
      id: 'att-2',
      filename: 'Foundation_Design_Changes.dwg',
      size: 1536000,
      uploaded_by: 'John Smith',
      uploaded_at: '2024-01-15T11:00:00Z',
      file_type: 'application/dwg'
    },
    {
      id: 'att-3',
      filename: 'Cost_Impact_Analysis.xlsx',
      size: 512000,
      uploaded_by: 'Sarah Johnson',
      uploaded_at: '2024-01-16T09:15:00Z',
      file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  ],
  
  communications: [
    {
      id: 'comm-1',
      type: 'comment',
      message: 'Initial change request submitted for review. Geotechnical report attached.',
      author: 'John Smith',
      timestamp: '2024-01-15T10:30:00Z'
    },
    {
      id: 'comm-2',
      type: 'status_change',
      message: 'Status changed from Draft to Submitted',
      author: 'System',
      timestamp: '2024-01-15T10:31:00Z'
    },
    {
      id: 'comm-3',
      type: 'approval',
      message: 'Technical review approved by Technical Review Team',
      author: 'Technical Review Team',
      timestamp: '2024-01-16T14:20:00Z'
    },
    {
      id: 'comm-4',
      type: 'comment',
      message: 'Forwarded to project manager for approval. Cost analysis has been added.',
      author: 'Sarah Johnson',
      timestamp: '2024-01-16T15:00:00Z'
    },
    {
      id: 'comm-5',
      type: 'notification',
      message: 'Reminder: Approval due in 2 days',
      author: 'System',
      timestamp: '2024-01-20T09:00:00Z'
    }
  ],
  
  ...overrides
})

export const generateMockImpactAnalysis = (changeId: string): ImpactAnalysisData => ({
  changeId,
  
  critical_path_affected: true,
  schedule_impact_days: 14,
  affected_activities: [
    {
      id: 'act-1',
      name: 'Foundation Excavation',
      original_duration: 5,
      new_duration: 8,
      delay_days: 3,
      resource_impact: 'Additional excavation equipment required'
    },
    {
      id: 'act-2',
      name: 'Foundation Pour',
      original_duration: 3,
      new_duration: 6,
      delay_days: 3,
      resource_impact: 'Increased concrete volume and reinforcement'
    },
    {
      id: 'act-3',
      name: 'Foundation Curing',
      original_duration: 7,
      new_duration: 14,
      delay_days: 7,
      resource_impact: 'Extended curing time for deeper foundations'
    }
  ],
  
  total_cost_impact: 25000,
  direct_costs: 20000,
  indirect_costs: 5000,
  cost_savings: 0,
  cost_breakdown: {
    materials: 12000,
    labor: 6000,
    equipment: 4000,
    overhead: 2000,
    contingency: 1000
  },
  
  additional_resources_needed: [
    {
      resource_type: 'Excavation Equipment',
      quantity: 1,
      duration_days: 8,
      cost_per_unit: 500,
      total_cost: 4000
    },
    {
      resource_type: 'Concrete (m³)',
      quantity: 50,
      duration_days: 1,
      cost_per_unit: 150,
      total_cost: 7500
    },
    {
      resource_type: 'Reinforcement Steel (tons)',
      quantity: 5,
      duration_days: 1,
      cost_per_unit: 900,
      total_cost: 4500
    }
  ],
  
  resource_reallocation: [
    {
      from_activity: 'Site Preparation',
      to_activity: 'Foundation Work',
      resource_type: 'Construction Crew',
      quantity: 2,
      impact_description: 'Reallocate crew members to focus on foundation modifications'
    }
  ],
  
  new_risks: [
    {
      id: 'risk-1',
      description: 'Weather delays during extended foundation work',
      probability: 0.3,
      impact_score: 7,
      mitigation_cost: 2000,
      category: 'Schedule'
    },
    {
      id: 'risk-2',
      description: 'Additional soil stability issues discovered',
      probability: 0.2,
      impact_score: 9,
      mitigation_cost: 5000,
      category: 'Technical'
    }
  ],
  
  modified_risks: [
    {
      id: 'existing-risk-1',
      description: 'Foundation settlement',
      old_probability: 0.4,
      new_probability: 0.1,
      old_impact: 8,
      new_impact: 3,
      change_reason: 'Improved foundation design reduces settlement risk'
    }
  ],
  
  scenarios: {
    best_case: {
      cost_impact: 20000,
      schedule_impact: 10,
      probability: 0.2,
      description: 'Optimal weather conditions and no additional complications'
    },
    worst_case: {
      cost_impact: 35000,
      schedule_impact: 21,
      probability: 0.1,
      description: 'Weather delays and additional soil issues discovered'
    },
    most_likely: {
      cost_impact: 25000,
      schedule_impact: 14,
      probability: 0.7,
      description: 'Standard implementation with minor complications'
    }
  },
  
  analyzed_by: 'Engineering Team',
  analyzed_at: '2024-01-16T11:30:00Z',
  approved_by: 'Sarah Johnson',
  approved_at: '2024-01-16T15:45:00Z'
})

export const generateMockAnalytics = (): ChangeAnalytics => ({
  total_changes: 150,
  changes_by_status: {
    'approved': 80,
    'pending_approval': 25,
    'under_review': 20,
    'rejected': 15,
    'implementing': 8,
    'implemented': 2
  },
  changes_by_type: {
    'design': 60,
    'scope': 40,
    'budget': 30,
    'schedule': 20,
    'regulatory': 15,
    'resource': 12,
    'quality': 8,
    'safety': 5
  },
  changes_by_priority: {
    'high': 30,
    'medium': 80,
    'low': 35,
    'critical': 5
  },
  
  average_approval_time_days: 5.2,
  average_implementation_time_days: 12.5,
  approval_rate_percentage: 76.7,
  
  cost_estimate_accuracy: 85.3,
  schedule_estimate_accuracy: 78.9,
  
  monthly_change_volume: [
    { month: 'Jan', approved_changes: 12, rejected_changes: 3, total_changes: 15, average_approval_time: 4.8 },
    { month: 'Feb', approved_changes: 15, rejected_changes: 2, total_changes: 17, average_approval_time: 5.1 },
    { month: 'Mar', approved_changes: 18, rejected_changes: 4, total_changes: 22, average_approval_time: 5.5 },
    { month: 'Apr', approved_changes: 14, rejected_changes: 3, total_changes: 17, average_approval_time: 4.9 },
    { month: 'May', approved_changes: 21, rejected_changes: 3, total_changes: 24, average_approval_time: 5.3 }
  ],
  
  top_change_categories: [
    { category: 'Design', count: 60, percentage: 40.0, trend: 'increasing' },
    { category: 'Scope', count: 40, percentage: 26.7, trend: 'stable' },
    { category: 'Budget', count: 30, percentage: 20.0, trend: 'decreasing' },
    { category: 'Schedule', count: 20, percentage: 13.3, trend: 'stable' }
  ],
  
  changes_by_project: [
    { project_id: 'proj-1', project_name: 'Office Complex Phase 1', count: 25, approval_rate: 80.0, average_cost_impact: 15000 },
    { project_id: 'proj-2', project_name: 'Residential Tower A', count: 20, approval_rate: 75.0, average_cost_impact: 12000 },
    { project_id: 'proj-3', project_name: 'Shopping Center Renovation', count: 18, approval_rate: 83.3, average_cost_impact: 8000 },
    { project_id: 'proj-4', project_name: 'Industrial Warehouse', count: 15, approval_rate: 73.3, average_cost_impact: 20000 }
  ],
  
  high_impact_changes: [
    { id: 'cr-001', title: 'Foundation Design Modification', impact_score: 8.5, cost_impact: 25000, schedule_impact: 14, status: 'pending_approval' },
    { id: 'cr-015', title: 'HVAC System Upgrade', impact_score: 7.8, cost_impact: 45000, schedule_impact: 21, status: 'approved' },
    { id: 'cr-032', title: 'Structural Steel Modification', impact_score: 9.2, cost_impact: 65000, schedule_impact: 28, status: 'implementing' }
  ],
  
  bottlenecks: [
    {
      stage: 'Technical Review',
      average_delay_days: 3.2,
      frequency: 15,
      suggested_actions: ['Add more technical reviewers', 'Implement parallel review process', 'Improve documentation standards']
    },
    {
      stage: 'Budget Approval',
      average_delay_days: 2.8,
      frequency: 12,
      suggested_actions: ['Delegate approval authority', 'Implement tiered approval limits', 'Streamline financial analysis']
    }
  ],
  
  efficiency_metrics: {
    changes_per_project: 3.8,
    cost_per_change: 18500,
    time_to_approval: 5.2,
    implementation_success_rate: 92.5
  }
})

// Additional mock data for various scenarios
export const generateMockChangeRequests = (count: number = 10): ChangeRequest[] => {
  const statuses: ChangeRequest['status'][] = ['pending_approval', 'approved', 'under_review', 'implementing', 'implemented']
  const types: ChangeRequest['change_type'][] = ['design', 'scope', 'budget', 'schedule', 'regulatory']
  const priorities: ChangeRequest['priority'][] = ['low', 'medium', 'high', 'critical']
  
  return Array.from({ length: count }, (_, index) => 
    generateMockChangeRequest({
      id: `cr-${String(index + 1).padStart(3, '0')}`,
      change_number: `CR-2024-${String(index + 1).padStart(4, '0')}`,
      title: `Change Request ${index + 1}`,
      status: statuses[index % statuses.length]!,
      change_type: types[index % types.length]!,
      priority: priorities[index % priorities.length]!,
      estimated_cost_impact: Math.floor(Math.random() * 50000) + 5000,
      estimated_schedule_impact_days: Math.floor(Math.random() * 30) + 1
    })
  )
}

export const mockDataService = {
  getChangeRequests: () => generateMockChangeRequests(10),
  getChangeRequest: (id: string) => generateMockChangeRequest({ id }),
  getImpactAnalysis: (changeId: string) => generateMockImpactAnalysis(changeId),
  getAnalytics: () => generateMockAnalytics()
}