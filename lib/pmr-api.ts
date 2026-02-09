/**
 * Enhanced PMR API Client
 * Type-safe API calls with error handling, caching, and retry mechanisms
 */

import { apiRequest, APIError, RequestConfig } from './api'
import type {
  PMRReport,
  PMRGenerationRequest,
  ChatEditRequest,
  ChatEditResponse,
  AIInsight,
  MonteCarloResults,
  ExportJob,
  PMRTemplate,
  CollaborationSession,
  PMRSection,
  PMRSearchFilters,
  InsightFilters
} from '../components/pmr/types'

// ============================================================================
// Configuration
// ============================================================================

export const PMR_API_CONFIG = {
  baseUrl: '/api/reports/pmr',
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000
}

// ============================================================================
// Cache Management
// ============================================================================

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class PMRCache {
  private cache = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttl: number = PMR_API_CONFIG.cacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const isExpired = Date.now() - entry.timestamp > entry.ttl
    if (isExpired) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      return
    }

    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }
}

const pmrCache = new PMRCache()

// ============================================================================
// Error Handling
// ============================================================================

export class PMRAPIError extends APIError {
  constructor(
    message: string,
    status: number,
    code?: string,
    details?: any
  ) {
    super(message, status, code, details)
    this.name = 'PMRAPIError'
  }
}

function handlePMRError(error: any): never {
  if (error instanceof APIError) {
    throw new PMRAPIError(
      error.message,
      error.status,
      error.code,
      error.details
    )
  }

  if (error instanceof Error) {
    throw new PMRAPIError(error.message, 500, 'INTERNAL_ERROR')
  }

  throw new PMRAPIError('An unexpected error occurred', 500, 'UNKNOWN_ERROR')
}

// ============================================================================
// Request Helpers
// ============================================================================

interface PMRRequestConfig extends Omit<RequestConfig, 'cache'> {
  cache?: boolean
  cacheKey?: string
  cacheTTL?: number
  invalidateCache?: string | string[]
}

async function pmrRequest<T>(
  endpoint: string,
  config: PMRRequestConfig = {}
): Promise<T> {
  const {
    cache = PMR_API_CONFIG.cacheEnabled,
    cacheKey,
    cacheTTL = PMR_API_CONFIG.cacheTTL,
    invalidateCache,
    ...requestConfig
  } = config

  const fullEndpoint = `${PMR_API_CONFIG.baseUrl}${endpoint}`

  // Check cache for GET requests
  if (cache && cacheKey && requestConfig.method === 'GET') {
    const cached = pmrCache.get<T>(cacheKey)
    if (cached) {
      return cached
    }
  }

  try {
    const response = await apiRequest<T>(fullEndpoint, {
      ...requestConfig,
      retries: requestConfig.retries ?? PMR_API_CONFIG.retryAttempts
    })

    // Invalidate cache patterns if specified
    if (invalidateCache) {
      const patterns = Array.isArray(invalidateCache) ? invalidateCache : [invalidateCache]
      patterns.forEach(pattern => pmrCache.invalidate(pattern))
    }

    // Cache successful GET responses
    if (cache && cacheKey && requestConfig.method === 'GET' && response.data) {
      pmrCache.set(cacheKey, response.data, cacheTTL)
    }

    return response.data
  } catch (error) {
    handlePMRError(error)
  }
}

// ============================================================================
// PMR Report Management
// ============================================================================

/**
 * Generate a new Enhanced PMR with AI insights
 */
export async function generatePMR(
  request: PMRGenerationRequest
): Promise<{ id: string; status: string; estimated_completion: string; generation_job_id: string }> {
  return pmrRequest('/generate', {
    method: 'POST',
    body: JSON.stringify(request),
    invalidateCache: ['reports-list', `project-${request.project_id}`]
  })
}

/**
 * Retrieve Enhanced PMR with all sections and insights
 */
export async function getPMRReport(
  reportId: string,
  options: { includeInsights?: boolean; includeCollaboration?: boolean } = {}
): Promise<PMRReport> {
  const params = new URLSearchParams()
  if (options.includeInsights !== undefined) {
    params.append('include_insights', String(options.includeInsights))
  }
  if (options.includeCollaboration !== undefined) {
    params.append('include_collaboration', String(options.includeCollaboration))
  }

  const query = params.toString() ? `?${params.toString()}` : ''

  return pmrRequest<PMRReport>(`/${reportId}${query}`, {
    method: 'GET',
    cache: true,
    cacheKey: `report-${reportId}${query}`,
    cacheTTL: 2 * 60 * 1000 // 2 minutes for individual reports
  })
}

/**
 * List PMR reports with filtering
 */
export async function listPMRReports(
  filters?: PMRSearchFilters,
  page: number = 1,
  limit: number = 20
): Promise<{ reports: PMRReport[]; total: number; page: number; totalPages: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  })

  if (filters) {
    if (filters.status?.length) {
      params.append('status', filters.status.join(','))
    }
    if (filters.projects?.length) {
      params.append('projects', filters.projects.join(','))
    }
    if (filters.templates?.length) {
      params.append('templates', filters.templates.join(','))
    }
    if (filters.dateRange) {
      params.append('date_start', filters.dateRange.start)
      params.append('date_end', filters.dateRange.end)
    }
    if (filters.hasAIInsights !== null) {
      params.append('has_ai_insights', String(filters.hasAIInsights))
    }
  }

  return pmrRequest(`?${params.toString()}`, {
    method: 'GET',
    cache: true,
    cacheKey: `reports-list-${params.toString()}`,
    cacheTTL: 1 * 60 * 1000 // 1 minute for lists
  })
}

/**
 * Update PMR report metadata
 */
export async function updatePMRReport(
  reportId: string,
  updates: Partial<Pick<PMRReport, 'title' | 'status' | 'template_customizations'>>
): Promise<PMRReport> {
  return pmrRequest(`/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
    invalidateCache: [`report-${reportId}`, 'reports-list']
  })
}

/**
 * Delete PMR report
 */
export async function deletePMRReport(reportId: string): Promise<void> {
  return pmrRequest(`/${reportId}`, {
    method: 'DELETE',
    invalidateCache: [`report-${reportId}`, 'reports-list']
  })
}

// ============================================================================
// Section Management
// ============================================================================

/**
 * Update a specific section in the PMR report
 */
export async function updatePMRSection(
  reportId: string,
  sectionId: string,
  content: any,
  mergeStrategy: 'replace' | 'merge' = 'replace'
): Promise<PMRSection> {
  return pmrRequest(`/${reportId}/sections/${sectionId}`, {
    method: 'PUT',
    body: JSON.stringify({ content, merge_strategy: mergeStrategy }),
    invalidateCache: [`report-${reportId}`]
  })
}

/**
 * Add a new section to the PMR report
 */
export async function addPMRSection(
  reportId: string,
  section: Omit<PMRSection, 'last_modified' | 'modified_by'>
): Promise<PMRSection> {
  return pmrRequest(`/${reportId}/sections`, {
    method: 'POST',
    body: JSON.stringify(section),
    invalidateCache: [`report-${reportId}`]
  })
}

/**
 * Delete a section from the PMR report
 */
export async function deletePMRSection(
  reportId: string,
  sectionId: string
): Promise<void> {
  return pmrRequest(`/${reportId}/sections/${sectionId}`, {
    method: 'DELETE',
    invalidateCache: [`report-${reportId}`]
  })
}

// ============================================================================
// Interactive Chat Editing
// ============================================================================

/**
 * Start or continue a chat-based editing session
 */
export async function chatEditPMR(
  reportId: string,
  request: ChatEditRequest
): Promise<ChatEditResponse> {
  return pmrRequest(`/${reportId}/edit/chat`, {
    method: 'POST',
    body: JSON.stringify(request),
    invalidateCache: [`report-${reportId}`],
    cache: false // Never cache chat responses
  })
}

/**
 * Get chat session history
 */
export async function getChatSessionHistory(
  reportId: string,
  sessionId: string
): Promise<Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>> {
  return pmrRequest(`/${reportId}/edit/chat/${sessionId}/history`, {
    method: 'GET',
    cache: true,
    cacheKey: `chat-history-${sessionId}`,
    cacheTTL: 30 * 1000 // 30 seconds
  })
}

// ============================================================================
// AI Insights
// ============================================================================

/**
 * Generate additional AI insights for a report
 */
export async function generateAIInsights(
  reportId: string,
  options: {
    insight_types?: Array<'prediction' | 'recommendation' | 'alert' | 'summary'>
    categories?: Array<'budget' | 'schedule' | 'resource' | 'risk' | 'quality'>
    context?: Record<string, any>
  } = {}
): Promise<AIInsight[]> {
  return pmrRequest(`/${reportId}/insights/generate`, {
    method: 'POST',
    body: JSON.stringify(options),
    invalidateCache: [`report-${reportId}`],
    cache: false
  })
}

/**
 * Get AI insights for a report with filtering
 */
export async function getAIInsights(
  reportId: string,
  filters?: InsightFilters
): Promise<AIInsight[]> {
  const params = new URLSearchParams()
  
  if (filters) {
    if (filters.categories?.length) {
      params.append('categories', filters.categories.join(','))
    }
    if (filters.types?.length) {
      params.append('types', filters.types.join(','))
    }
    if (filters.priorities?.length) {
      params.append('priorities', filters.priorities.join(','))
    }
    if (filters.validated !== null) {
      params.append('validated', String(filters.validated))
    }
    if (filters.minConfidence) {
      params.append('min_confidence', String(filters.minConfidence))
    }
  }

  const query = params.toString() ? `?${params.toString()}` : ''

  return pmrRequest(`/${reportId}/insights${query}`, {
    method: 'GET',
    cache: true,
    cacheKey: `insights-${reportId}${query}`,
    cacheTTL: 2 * 60 * 1000
  })
}

/**
 * Validate an AI insight
 */
export async function validateAIInsight(
  reportId: string,
  insightId: string,
  isValid: boolean,
  notes?: string
): Promise<AIInsight> {
  return pmrRequest(`/${reportId}/insights/${insightId}/validate`, {
    method: 'POST',
    body: JSON.stringify({ is_valid: isValid, notes }),
    invalidateCache: [`report-${reportId}`, `insights-${reportId}`]
  })
}

/**
 * Provide feedback on an AI insight
 */
export async function feedbackAIInsight(
  reportId: string,
  insightId: string,
  feedback: 'helpful' | 'not_helpful'
): Promise<void> {
  return pmrRequest(`/${reportId}/insights/${insightId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback }),
    invalidateCache: [`report-${reportId}`, `insights-${reportId}`]
  })
}

// ============================================================================
// Monte Carlo Analysis
// ============================================================================

/**
 * Run Monte Carlo analysis for a report
 */
export async function runMonteCarloAnalysis(
  reportId: string,
  params: {
    analysis_type: 'budget_variance' | 'schedule_variance' | 'resource_risk' | 'comprehensive'
    iterations?: number
    confidence_levels?: number[]
    parameters?: Record<string, any>
  }
): Promise<MonteCarloResults> {
  return pmrRequest(`/${reportId}/monte-carlo`, {
    method: 'POST',
    body: JSON.stringify(params),
    invalidateCache: [`report-${reportId}`],
    cache: false,
    timeout: 60000 // 60 seconds for long-running analysis
  })
}

/**
 * Get Monte Carlo analysis results
 */
export async function getMonteCarloResults(
  reportId: string
): Promise<MonteCarloResults | null> {
  return pmrRequest(`/${reportId}/monte-carlo`, {
    method: 'GET',
    cache: true,
    cacheKey: `monte-carlo-${reportId}`,
    cacheTTL: 5 * 60 * 1000
  })
}

// ============================================================================
// Export Management
// ============================================================================

/**
 * Export PMR in specified format
 */
export async function exportPMR(
  reportId: string,
  config: {
    format: 'pdf' | 'excel' | 'slides' | 'word'
    template_id?: string
    options?: {
      include_charts?: boolean
      include_raw_data?: boolean
      branding?: Record<string, any>
      sections?: string[]
    }
  }
): Promise<ExportJob> {
  return pmrRequest(`/${reportId}/export`, {
    method: 'POST',
    body: JSON.stringify(config),
    cache: false
  })
}

/**
 * Get export job status
 */
export async function getExportJobStatus(
  reportId: string,
  jobId: string
): Promise<ExportJob> {
  return pmrRequest(`/${reportId}/export/${jobId}`, {
    method: 'GET',
    cache: false // Always get fresh status
  })
}

/**
 * List export jobs for a report
 */
export async function listExportJobs(
  reportId: string
): Promise<ExportJob[]> {
  return pmrRequest(`/${reportId}/export`, {
    method: 'GET',
    cache: true,
    cacheKey: `export-jobs-${reportId}`,
    cacheTTL: 30 * 1000 // 30 seconds
  })
}

/**
 * Download exported file
 */
export async function downloadExport(
  reportId: string,
  jobId: string,
  filename?: string
): Promise<void> {
  const job = await getExportJobStatus(reportId, jobId)
  
  if (job.status !== 'completed' || !job.file_url) {
    throw new PMRAPIError('Export not ready for download', 400, 'EXPORT_NOT_READY')
  }

  // Use the file_url to download
  const response = await fetch(job.file_url)
  if (!response.ok) {
    throw new PMRAPIError('Failed to download export', response.status, 'DOWNLOAD_FAILED')
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `pmr-export-${reportId}.${job.export_format}`
  document.body.appendChild(a)
  a.click()
  
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

// ============================================================================
// Template Management
// ============================================================================

/**
 * List available PMR templates
 */
export async function listPMRTemplates(
  filters?: {
    template_type?: string
    industry_focus?: string
    is_public?: boolean
  }
): Promise<PMRTemplate[]> {
  const params = new URLSearchParams()
  
  if (filters) {
    if (filters.template_type) {
      params.append('template_type', filters.template_type)
    }
    if (filters.industry_focus) {
      params.append('industry_focus', filters.industry_focus)
    }
    if (filters.is_public !== undefined) {
      params.append('is_public', String(filters.is_public))
    }
  }

  const query = params.toString() ? `?${params.toString()}` : ''

  return pmrRequest(`/templates${query}`, {
    method: 'GET',
    cache: true,
    cacheKey: `templates${query}`,
    cacheTTL: 10 * 60 * 1000 // 10 minutes
  })
}

/**
 * Get a specific template
 */
export async function getPMRTemplate(templateId: string): Promise<PMRTemplate> {
  return pmrRequest(`/templates/${templateId}`, {
    method: 'GET',
    cache: true,
    cacheKey: `template-${templateId}`,
    cacheTTL: 10 * 60 * 1000
  })
}

/**
 * Get AI-suggested templates for a project
 */
export async function getAISuggestedTemplates(
  projectId: string,
  projectType?: string,
  industryFocus?: string
): Promise<Array<PMRTemplate & { suggestion_reason: string; confidence: number }>> {
  const params = new URLSearchParams({ project_id: projectId })
  if (projectType) params.append('project_type', projectType)
  if (industryFocus) params.append('industry_focus', industryFocus)

  return pmrRequest(`/templates/suggestions?${params.toString()}`, {
    method: 'GET',
    cache: true,
    cacheKey: `template-suggestions-${projectId}`,
    cacheTTL: 5 * 60 * 1000
  })
}

// ============================================================================
// Collaboration
// ============================================================================

/**
 * Start a collaborative editing session
 */
export async function startCollaborationSession(
  reportId: string,
  participants: string[],
  permissions?: Record<string, 'view' | 'comment' | 'edit'>
): Promise<CollaborationSession> {
  return pmrRequest(`/${reportId}/collaborate`, {
    method: 'POST',
    body: JSON.stringify({ participants, permissions }),
    cache: false
  })
}

/**
 * Get collaboration session details
 */
export async function getCollaborationSession(
  reportId: string,
  sessionId: string
): Promise<CollaborationSession> {
  return pmrRequest(`/${reportId}/collaborate/${sessionId}`, {
    method: 'GET',
    cache: false // Real-time data, don't cache
  })
}

/**
 * End a collaboration session
 */
export async function endCollaborationSession(
  reportId: string,
  sessionId: string
): Promise<void> {
  return pmrRequest(`/${reportId}/collaborate/${sessionId}`, {
    method: 'DELETE',
    cache: false
  })
}

// ============================================================================
// Cache Utilities
// ============================================================================

/**
 * Manually invalidate cache for a report
 */
export function invalidateReportCache(reportId: string): void {
  pmrCache.invalidate(`report-${reportId}`)
  pmrCache.invalidate(`insights-${reportId}`)
  pmrCache.invalidate(`monte-carlo-${reportId}`)
  pmrCache.invalidate(`export-jobs-${reportId}`)
}

/**
 * Clear all PMR cache
 */
export function clearPMRCache(): void {
  pmrCache.invalidate()
}

/**
 * Check if a report is cached
 */
export function isReportCached(reportId: string): boolean {
  return pmrCache.has(`report-${reportId}`)
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch update multiple sections
 */
export async function batchUpdateSections(
  reportId: string,
  updates: Array<{ section_id: string; content: any }>
): Promise<PMRSection[]> {
  return pmrRequest(`/${reportId}/sections/batch`, {
    method: 'PUT',
    body: JSON.stringify({ updates }),
    invalidateCache: [`report-${reportId}`]
  })
}

/**
 * Batch validate multiple insights
 */
export async function batchValidateInsights(
  reportId: string,
  validations: Array<{ insight_id: string; is_valid: boolean; notes?: string }>
): Promise<AIInsight[]> {
  return pmrRequest(`/${reportId}/insights/batch-validate`, {
    method: 'POST',
    body: JSON.stringify({ validations }),
    invalidateCache: [`report-${reportId}`, `insights-${reportId}`]
  })
}

// ============================================================================
// Export Default API Client
// ============================================================================

export const pmrAPI = {
  // Report management
  generatePMR,
  getPMRReport,
  listPMRReports,
  updatePMRReport,
  deletePMRReport,
  
  // Section management
  updatePMRSection,
  addPMRSection,
  deletePMRSection,
  batchUpdateSections,
  
  // Chat editing
  chatEditPMR,
  getChatSessionHistory,
  
  // AI insights
  generateAIInsights,
  getAIInsights,
  validateAIInsight,
  feedbackAIInsight,
  batchValidateInsights,
  
  // Monte Carlo
  runMonteCarloAnalysis,
  getMonteCarloResults,
  
  // Export
  exportPMR,
  getExportJobStatus,
  listExportJobs,
  downloadExport,
  
  // Templates
  listPMRTemplates,
  getPMRTemplate,
  getAISuggestedTemplates,
  
  // Collaboration
  startCollaborationSession,
  getCollaborationSession,
  endCollaborationSession,
  
  // Cache utilities
  invalidateReportCache,
  clearPMRCache,
  isReportCached
}

export default pmrAPI
