/**
 * usePMRContext Hook
 * 
 * Convenience hook for accessing PMR context with additional utilities
 */

import { useCallback, useMemo } from 'react'
import { usePMRContext as useContext } from '@/contexts/PMRContext'
import type { PMRSection, AIInsight, InsightFilters } from '@/components/pmr/types'

/**
 * Enhanced PMR Context Hook
 * 
 * Provides convenient access to PMR state and actions with additional utilities
 */
export function usePMRContext() {
  const { state, actions } = useContext()

  /**
   * Check if report is loaded
   */
  const hasReport = useMemo(() => state.currentReport !== null, [state.currentReport])

  /**
   * Get current report ID
   */
  const reportId = useMemo(() => state.currentReport?.id, [state.currentReport])

  /**
   * Check if report is being modified
   */
  const isModifying = useMemo(
    () => state.isLoading || state.isSaving,
    [state.isLoading, state.isSaving]
  )

  /**
   * Check if there are unsaved changes
   */
  const hasUnsavedChanges = useMemo(
    () => state.pendingChanges.size > 0,
    [state.pendingChanges]
  )

  /**
   * Get section by ID
   */
  const getSection = useCallback(
    (sectionId: string): PMRSection | undefined => {
      return state.currentReport?.sections.find(s => s.section_id === sectionId)
    },
    [state.currentReport]
  )

  /**
   * Get all sections
   */
  const sections = useMemo(
    () => state.currentReport?.sections || [],
    [state.currentReport]
  )

  /**
   * Get AI insights with optional filtering
   */
  const getInsights = useCallback(
    (filters?: Partial<InsightFilters>): AIInsight[] => {
      if (!state.currentReport) return []
      
      if (!filters) return state.currentReport.ai_insights
      
      const defaultFilters: InsightFilters = {
        categories: [],
        types: [],
        priorities: [],
        validated: null,
        minConfidence: 0,
        ...filters
      }
      
      return actions.filterInsights(defaultFilters)
    },
    [state.currentReport, actions]
  )

  /**
   * Get insights by category
   */
  const getInsightsByCategory = useCallback(
    (category: string): AIInsight[] => {
      return getInsights({ categories: [category] })
    },
    [getInsights]
  )

  /**
   * Get high-priority insights
   */
  const getHighPriorityInsights = useCallback(
    (): AIInsight[] => {
      return getInsights({ priorities: ['high', 'critical'] })
    },
    [getInsights]
  )

  /**
   * Get unvalidated insights
   */
  const getUnvalidatedInsights = useCallback(
    (): AIInsight[] => {
      return getInsights({ validated: false })
    },
    [getInsights]
  )

  /**
   * Check if Monte Carlo analysis is available
   */
  const hasMonteCarloAnalysis = useMemo(
    () => state.currentReport?.monte_carlo_analysis !== undefined,
    [state.currentReport]
  )

  /**
   * Get Monte Carlo results
   */
  const monteCarloResults = useMemo(
    () => state.currentReport?.monte_carlo_analysis,
    [state.currentReport]
  )

  /**
   * Check if collaboration is active
   */
  const isCollaborating = useMemo(
    () => state.collaborationSession !== null,
    [state.collaborationSession]
  )

  /**
   * Get active collaborators
   */
  const activeCollaborators = useMemo(
    () => state.collaborationSession?.active_editors || [],
    [state.collaborationSession]
  )

  /**
   * Get export jobs
   */
  const exportJobs = useMemo(() => state.exportJobs, [state.exportJobs])

  /**
   * Get active export jobs
   */
  const activeExportJobs = useMemo(
    () => state.exportJobs.filter(job => job.status === 'processing' || job.status === 'queued'),
    [state.exportJobs]
  )

  /**
   * Get completed export jobs
   */
  const completedExportJobs = useMemo(
    () => state.exportJobs.filter(job => job.status === 'completed'),
    [state.exportJobs]
  )

  /**
   * Check if report can be edited
   */
  const canEdit = useMemo(
    () => hasReport && !state.isLoading && state.isOnline,
    [hasReport, state.isLoading, state.isOnline]
  )

  /**
   * Get report status
   */
  const reportStatus = useMemo(
    () => state.currentReport?.status,
    [state.currentReport]
  )

  /**
   * Check if report is in draft status
   */
  const isDraft = useMemo(
    () => reportStatus === 'draft',
    [reportStatus]
  )

  /**
   * Update section with debouncing support
   */
  const updateSectionDebounced = useCallback(
    (sectionId: string, content: any, delay: number = 1000) => {
      // Apply optimistic update immediately
      actions.applyOptimisticUpdate(sectionId, content)
      
      // Debounce the actual API call
      const timeoutId = setTimeout(() => {
        actions.updateSection(sectionId, content)
      }, delay)
      
      return () => clearTimeout(timeoutId)
    },
    [actions]
  )

  /**
   * Batch update multiple sections
   */
  const updateSections = useCallback(
    async (updates: Array<{ sectionId: string; content: any }>) => {
      for (const update of updates) {
        await actions.updateSection(update.sectionId, update.content)
      }
    },
    [actions]
  )

  /**
   * Generate insights for specific categories
   */
  const generateCategoryInsights = useCallback(
    async (categories: string[]) => {
      await actions.generateInsights(categories)
    },
    [actions]
  )

  /**
   * Validate multiple insights
   */
  const validateInsights = useCallback(
    async (insightIds: string[], isValid: boolean, notes?: string) => {
      for (const insightId of insightIds) {
        await actions.validateInsight(insightId, isValid, notes)
      }
    },
    [actions]
  )

  /**
   * Export report with progress tracking
   */
  const exportWithProgress = useCallback(
    async (
      format: 'pdf' | 'excel' | 'slides' | 'word',
      options?: any,
      onProgress?: (progress: number) => void
    ): Promise<string> => {
      const jobId = await actions.exportReport(format, options)
      
      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const job = await actions.getExportStatus(jobId)
          
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(pollInterval)
            if (onProgress) onProgress(100)
          } else if (onProgress) {
            // Estimate progress based on time elapsed
            const elapsed = Date.now() - new Date(job.started_at).getTime()
            const estimatedProgress = Math.min(90, (elapsed / 30000) * 100)
            onProgress(estimatedProgress)
          }
        } catch (error) {
          clearInterval(pollInterval)
          throw error
        }
      }, 1000)
      
      return jobId
    },
    [actions]
  )

  return {
    // State
    state,
    hasReport,
    reportId,
    isModifying,
    hasUnsavedChanges,
    canEdit,
    reportStatus,
    isDraft,
    isCollaborating,
    hasMonteCarloAnalysis,
    
    // Getters
    getSection,
    sections,
    getInsights,
    getInsightsByCategory,
    getHighPriorityInsights,
    getUnvalidatedInsights,
    monteCarloResults,
    activeCollaborators,
    exportJobs,
    activeExportJobs,
    completedExportJobs,
    
    // Actions (original)
    ...actions,
    
    // Enhanced actions
    updateSectionDebounced,
    updateSections,
    generateCategoryInsights,
    validateInsights,
    exportWithProgress
  }
}

export default usePMRContext
