// Costbook Supabase Data Fetching Functions
// Handles all data access for projects, commitments, and actuals

import { supabase } from '@/lib/api/supabase-minimal'
import {
  Project,
  Commitment,
  Actual,
  ProjectWithFinancials,
  Currency,
  ProjectStatus,
  POStatus,
  ActualStatus
} from '@/types/costbook'
import { enrichProjectWithFinancials } from '@/lib/costbook-calculations'

// Error types for better error handling
export class CostbookQueryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string
  ) {
    super(message)
    this.name = 'CostbookQueryError'
  }
}

/**
 * Fetches all projects with their financial data (commitments and actuals aggregated)
 * Uses Supabase joins to minimize database queries
 * 
 * @returns Array of projects enriched with financial calculations
 */
export async function fetchProjectsWithFinancials(): Promise<ProjectWithFinancials[]> {
  try {
    // Fetch all projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })

    if (projectsError) {
      throw new CostbookQueryError(
        'Failed to fetch projects',
        'PROJECTS_FETCH_ERROR',
        projectsError.message
      )
    }

    if (!projects || projects.length === 0) {
      return []
    }

    // Fetch all commitments
    const { data: commitments, error: commitmentsError } = await supabase
      .from('commitments')
      .select('*')
      .in('project_id', projects.map(p => p.id))

    if (commitmentsError) {
      console.warn('Failed to fetch commitments:', commitmentsError.message)
    }

    // Fetch all actuals
    const { data: actuals, error: actualsError } = await supabase
      .from('actuals')
      .select('*')
      .in('project_id', projects.map(p => p.id))

    if (actualsError) {
      console.warn('Failed to fetch actuals:', actualsError.message)
    }

    // Group commitments and actuals by project
    const commitmentsByProject = new Map<string, Commitment[]>()
    const actualsByProject = new Map<string, Actual[]>()

    ;(commitments || []).forEach(c => {
      const existing = commitmentsByProject.get(c.project_id) || []
      commitmentsByProject.set(c.project_id, [...existing, mapToCommitment(c)])
    })

    ;(actuals || []).forEach(a => {
      const existing = actualsByProject.get(a.project_id) || []
      actualsByProject.set(a.project_id, [...existing, mapToActual(a)])
    })

    // Enrich each project with financial data
    return projects.map(project => {
      const projectCommitments = commitmentsByProject.get(project.id) || []
      const projectActuals = actualsByProject.get(project.id) || []
      
      return enrichProjectWithFinancials(
        mapToProject(project),
        projectCommitments,
        projectActuals
      )
    })
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error fetching projects with financials',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Fetches a single project with its financial data
 * 
 * @param projectId - The project ID to fetch
 * @returns Project with financial calculations or null if not found
 */
export async function fetchProjectWithFinancials(
  projectId: string
): Promise<ProjectWithFinancials | null> {
  try {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return null // Not found
      }
      throw new CostbookQueryError(
        'Failed to fetch project',
        'PROJECT_FETCH_ERROR',
        projectError.message
      )
    }

    if (!project) {
      return null
    }

    // Fetch commitments for this project
    const { data: commitments, error: commitmentsError } = await supabase
      .from('commitments')
      .select('*')
      .eq('project_id', projectId)

    if (commitmentsError) {
      console.warn('Failed to fetch commitments:', commitmentsError.message)
    }

    // Fetch actuals for this project
    const { data: actuals, error: actualsError } = await supabase
      .from('actuals')
      .select('*')
      .eq('project_id', projectId)

    if (actualsError) {
      console.warn('Failed to fetch actuals:', actualsError.message)
    }

    return enrichProjectWithFinancials(
      mapToProject(project),
      (commitments || []).map(mapToCommitment),
      (actuals || []).map(mapToActual)
    )
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error fetching project',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Fetches commitments for a specific project
 * 
 * @param projectId - The project ID
 * @returns Array of commitments
 */
export async function fetchCommitmentsByProject(
  projectId: string
): Promise<Commitment[]> {
  try {
    const { data, error } = await supabase
      .from('commitments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new CostbookQueryError(
        'Failed to fetch commitments',
        'COMMITMENTS_FETCH_ERROR',
        error.message
      )
    }

    return (data || []).map(mapToCommitment)
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error fetching commitments',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Fetches actuals for a specific project
 * 
 * @param projectId - The project ID
 * @returns Array of actuals
 */
export async function fetchActualsByProject(
  projectId: string
): Promise<Actual[]> {
  try {
    const { data, error } = await supabase
      .from('actuals')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new CostbookQueryError(
        'Failed to fetch actuals',
        'ACTUALS_FETCH_ERROR',
        error.message
      )
    }

    return (data || []).map(mapToActual)
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error fetching actuals',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Fetches all commitments (for all projects)
 * 
 * @returns Array of all commitments
 */
export async function fetchAllCommitments(): Promise<Commitment[]> {
  try {
    const { data, error } = await supabase
      .from('commitments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new CostbookQueryError(
        'Failed to fetch all commitments',
        'COMMITMENTS_FETCH_ERROR',
        error.message
      )
    }

    return (data || []).map(mapToCommitment)
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error fetching all commitments',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Fetches all actuals (for all projects)
 * 
 * @returns Array of all actuals
 */
export async function fetchAllActuals(): Promise<Actual[]> {
  try {
    const { data, error } = await supabase
      .from('actuals')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new CostbookQueryError(
        'Failed to fetch all actuals',
        'ACTUALS_FETCH_ERROR',
        error.message
      )
    }

    return (data || []).map(mapToActual)
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error fetching all actuals',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Creates a new commitment in the database
 * 
 * @param commitment - Commitment data (without id, created_at, updated_at)
 * @returns Created commitment
 */
export async function createCommitment(
  commitment: Omit<Commitment, 'id' | 'created_at' | 'updated_at'>
): Promise<Commitment> {
  try {
    const { data, error } = await supabase
      .from('commitments')
      .insert(commitment)
      .select()
      .single()

    if (error) {
      throw new CostbookQueryError(
        'Failed to create commitment',
        'COMMITMENT_CREATE_ERROR',
        error.message
      )
    }

    return mapToCommitment(data)
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error creating commitment',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Creates a new actual in the database
 * 
 * @param actual - Actual data (without id, created_at, updated_at)
 * @returns Created actual
 */
export async function createActual(
  actual: Omit<Actual, 'id' | 'created_at' | 'updated_at'>
): Promise<Actual> {
  try {
    const { data, error } = await supabase
      .from('actuals')
      .insert(actual)
      .select()
      .single()

    if (error) {
      throw new CostbookQueryError(
        'Failed to create actual',
        'ACTUAL_CREATE_ERROR',
        error.message
      )
    }

    return mapToActual(data)
  } catch (error) {
    if (error instanceof CostbookQueryError) {
      throw error
    }
    throw new CostbookQueryError(
      'Unexpected error creating actual',
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : String(error)
    )
  }
}

// ============================================
// Data Mapping Functions
// ============================================

/**
 * Maps raw database row to Project type
 */
function mapToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description,
    status: mapToProjectStatus(row.status),
    budget: parseFloat(row.budget) || 0,
    currency: mapToCurrency(row.currency),
    start_date: row.start_date,
    end_date: row.end_date,
    project_manager: row.project_manager,
    client_id: row.client_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * Maps raw database row to Commitment type
 */
function mapToCommitment(row: any): Commitment {
  return {
    id: row.id,
    project_id: row.project_id,
    po_number: row.po_number || '',
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name || '',
    description: row.description || '',
    amount: parseFloat(row.amount) || 0,
    currency: mapToCurrency(row.currency),
    status: mapToPOStatus(row.status),
    issue_date: row.issue_date,
    delivery_date: row.delivery_date,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * Maps raw database row to Actual type
 */
function mapToActual(row: any): Actual {
  return {
    id: row.id,
    project_id: row.project_id,
    commitment_id: row.commitment_id,
    po_number: row.po_number,
    vendor_id: row.vendor_id,
    vendor_name: row.vendor_name || '',
    description: row.description || '',
    amount: parseFloat(row.amount) || 0,
    currency: mapToCurrency(row.currency),
    status: mapToActualStatus(row.status),
    invoice_date: row.invoice_date,
    payment_date: row.payment_date,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

/**
 * Maps string to Currency enum with fallback
 */
function mapToCurrency(value: string | null | undefined): Currency {
  if (!value) return Currency.USD
  
  const upper = value.toUpperCase()
  if (Object.values(Currency).includes(upper as Currency)) {
    return upper as Currency
  }
  return Currency.USD
}

/**
 * Maps string to ProjectStatus enum with fallback
 */
function mapToProjectStatus(value: string | null | undefined): ProjectStatus {
  if (!value) return ProjectStatus.ACTIVE
  
  const lower = value.toLowerCase()
  if (Object.values(ProjectStatus).includes(lower as ProjectStatus)) {
    return lower as ProjectStatus
  }
  return ProjectStatus.ACTIVE
}

/**
 * Maps string to POStatus enum with fallback
 */
function mapToPOStatus(value: string | null | undefined): POStatus {
  if (!value) return POStatus.DRAFT
  
  const lower = value.toLowerCase()
  if (Object.values(POStatus).includes(lower as POStatus)) {
    return lower as POStatus
  }
  return POStatus.DRAFT
}

/**
 * Maps string to ActualStatus enum with fallback
 */
function mapToActualStatus(value: string | null | undefined): ActualStatus {
  if (!value) return ActualStatus.PENDING
  
  const lower = value.toLowerCase()
  if (Object.values(ActualStatus).includes(lower as ActualStatus)) {
    return lower as ActualStatus
  }
  return ActualStatus.PENDING
}

// ============================================
// Mock Data for Development/Testing
// ============================================

/**
 * Returns mock projects with financials for development/testing
 */
export function getMockProjectsWithFinancials(): ProjectWithFinancials[] {
  return [
    {
      id: 'proj-001',
      name: 'Website Redesign',
      description: 'Complete website overhaul with new branding',
      status: ProjectStatus.ACTIVE,
      budget: 150000,
      currency: Currency.USD,
      start_date: '2024-01-01',
      end_date: '2024-06-30',
      project_manager: 'John Smith',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-02-15T10:30:00Z',
      total_commitments: 75000,
      total_actuals: 35000,
      total_spend: 110000,
      variance: 40000,
      spend_percentage: 73.33,
      health_score: 100
    },
    {
      id: 'proj-002',
      name: 'Mobile App Development',
      description: 'iOS and Android app development',
      status: ProjectStatus.ACTIVE,
      budget: 250000,
      currency: Currency.USD,
      start_date: '2024-02-01',
      end_date: '2024-12-31',
      project_manager: 'Jane Doe',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-15T14:20:00Z',
      total_commitments: 120000,
      total_actuals: 80000,
      total_spend: 200000,
      variance: 50000,
      spend_percentage: 80,
      health_score: 100
    },
    {
      id: 'proj-003',
      name: 'Data Migration',
      description: 'Legacy system data migration to cloud',
      status: ProjectStatus.ON_HOLD,
      budget: 80000,
      currency: Currency.EUR,
      start_date: '2024-01-15',
      end_date: '2024-04-30',
      project_manager: 'Mike Wilson',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-02-15T09:00:00Z',
      total_commitments: 50000,
      total_actuals: 45000,
      total_spend: 95000,
      variance: -15000,
      spend_percentage: 118.75,
      health_score: 25
    },
    {
      id: 'proj-004',
      name: 'Security Audit',
      description: 'Comprehensive security assessment',
      status: ProjectStatus.COMPLETED,
      budget: 45000,
      currency: Currency.USD,
      start_date: '2023-11-01',
      end_date: '2024-01-31',
      project_manager: 'Sarah Connor',
      created_at: '2023-11-01T00:00:00Z',
      updated_at: '2024-01-31T18:00:00Z',
      total_commitments: 40000,
      total_actuals: 4500,
      total_spend: 44500,
      variance: 500,
      spend_percentage: 98.89,
      health_score: 55
    },
    {
      id: 'proj-005',
      name: 'CRM Integration',
      description: 'Salesforce integration with internal systems',
      status: ProjectStatus.ACTIVE,
      budget: 120000,
      currency: Currency.GBP,
      start_date: '2024-03-01',
      end_date: '2024-09-30',
      project_manager: 'David Lee',
      created_at: '2024-03-01T00:00:00Z',
      updated_at: '2024-03-10T11:45:00Z',
      total_commitments: 30000,
      total_actuals: 10000,
      total_spend: 40000,
      variance: 80000,
      spend_percentage: 33.33,
      health_score: 100
    }
  ]
}

/**
 * Returns mock commitments for development/testing
 */
export function getMockCommitments(): Commitment[] {
  return [
    {
      id: 'commit-001',
      project_id: 'proj-001',
      po_number: 'PO-2024-001',
      vendor_id: 'vendor-001',
      vendor_name: 'Design Agency Inc',
      description: 'UI/UX Design Services',
      amount: 35000,
      currency: Currency.USD,
      status: POStatus.APPROVED,
      issue_date: '2024-01-15',
      delivery_date: '2024-03-15',
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z'
    },
    {
      id: 'commit-002',
      project_id: 'proj-001',
      po_number: 'PO-2024-002',
      vendor_id: 'vendor-002',
      vendor_name: 'Dev Team LLC',
      description: 'Frontend Development',
      amount: 40000,
      currency: Currency.USD,
      status: POStatus.ISSUED,
      issue_date: '2024-02-01',
      delivery_date: '2024-05-31',
      created_at: '2024-02-01T00:00:00Z',
      updated_at: '2024-02-01T00:00:00Z'
    },
    {
      id: 'commit-003',
      project_id: 'proj-002',
      po_number: 'PO-2024-003',
      vendor_id: 'vendor-003',
      vendor_name: 'Mobile Experts',
      description: 'iOS Development',
      amount: 60000,
      currency: Currency.USD,
      status: POStatus.APPROVED,
      issue_date: '2024-02-15',
      delivery_date: '2024-08-31',
      created_at: '2024-02-15T00:00:00Z',
      updated_at: '2024-02-15T00:00:00Z'
    }
  ]
}

/**
 * Returns mock actuals for development/testing
 */
export function getMockActuals(): Actual[] {
  return [
    {
      id: 'actual-001',
      project_id: 'proj-001',
      commitment_id: 'commit-001',
      po_number: 'PO-2024-001',
      vendor_id: 'vendor-001',
      vendor_name: 'Design Agency Inc',
      description: 'Initial Design Phase',
      amount: 17500,
      currency: Currency.USD,
      status: ActualStatus.APPROVED,
      invoice_date: '2024-02-15',
      payment_date: '2024-02-28',
      created_at: '2024-02-15T00:00:00Z',
      updated_at: '2024-02-28T00:00:00Z'
    },
    {
      id: 'actual-002',
      project_id: 'proj-001',
      commitment_id: 'commit-001',
      po_number: 'PO-2024-001',
      vendor_id: 'vendor-001',
      vendor_name: 'Design Agency Inc',
      description: 'Final Design Delivery',
      amount: 17500,
      currency: Currency.USD,
      status: ActualStatus.PENDING,
      invoice_date: '2024-03-15',
      created_at: '2024-03-15T00:00:00Z',
      updated_at: '2024-03-15T00:00:00Z'
    },
    {
      id: 'actual-003',
      project_id: 'proj-002',
      commitment_id: 'commit-003',
      po_number: 'PO-2024-003',
      vendor_id: 'vendor-003',
      vendor_name: 'Mobile Experts',
      description: 'Milestone 1 Payment',
      amount: 20000,
      currency: Currency.USD,
      status: ActualStatus.APPROVED,
      invoice_date: '2024-03-01',
      payment_date: '2024-03-10',
      created_at: '2024-03-01T00:00:00Z',
      updated_at: '2024-03-10T00:00:00Z'
    }
  ]
}

// Add AT_RISK status to ProjectStatus for the mock data
declare module '@/types/costbook' {
  enum ProjectStatus {
    AT_RISK = 'at_risk'
  }
}