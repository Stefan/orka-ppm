'use client'

import React, { createContext, useContext, useCallback, useReducer, useEffect, useRef } from 'react'
import type {
  PMRReport,
  PMRSection,
  AIInsight,
  CollaborationSession,
  ExportJob,
  MonteCarloResults,
  PMRGenerationRequest,
  ChatEditRequest,
  ChatEditResponse,
  InsightFilters
} from '@/components/pmr/types'

/**
 * PMR Context State
 */
export interface PMRContextState {
  currentReport: PMRReport | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  collaborationSession: CollaborationSession | null
  exportJobs: ExportJob[]
  pendingChanges: Map<string, any>
  lastSyncTime: Date | null
  isOnline: boolean
}

/**
 * PMR Context Actions
 */
export interface PMRContextActions {
  // Report operations
  loadReport: (reportId: string) => Promise<void>
  createReport: (request: PMRGenerationRequest) => Promise<string>
  updateReport: (updates: Partial<PMRReport>) => Promise<void>
  deleteReport: (reportId: string) => Promise<void>
  
  // Section operations
  updateSection: (sectionId: string, content: any) => Promise<void>
  addSection: (section: Omit<PMRSection, 'last_modified' | 'modified_by'>) => Promise<void>
  removeSection: (sectionId: string) => Promise<void>
  reorderSections: (sectionIds: string[]) => Promise<void>
  
  // AI Insights operations
  generateInsights: (categories?: string[]) => Promise<void>
  validateInsight: (insightId: string, isValid: boolean, notes?: string) => Promise<void>
  provideFeedback: (insightId: string, feedback: 'helpful' | 'not_helpful') => Promise<void>
  filterInsights: (filters: InsightFilters) => AIInsight[]
  
  // Monte Carlo operations
  runMonteCarloAnalysis: (params: any) => Promise<void>
  
  // Chat-based editing
  sendChatEdit: (request: ChatEditRequest) => Promise<ChatEditResponse>
  
  // Export operations
  exportReport: (format: 'pdf' | 'excel' | 'slides' | 'word', options?: any) => Promise<string>
  getExportStatus: (jobId: string) => Promise<ExportJob>
  cancelExport: (jobId: string) => Promise<void>
  
  // Collaboration operations
  startCollaboration: (participants: string[]) => Promise<void>
  endCollaboration: () => Promise<void>
  
  // Error handling
  clearError: () => void
  retryLastOperation: () => Promise<void>
  
  // Optimistic updates
  applyOptimisticUpdate: (sectionId: string, content: any) => void
  revertOptimisticUpdate: (sectionId: string) => void
}

/**
 * Combined PMR Context Type
 */
export interface PMRContextType {
  state: PMRContextState
  actions: PMRContextActions
}

/**
 * Action types for reducer
 */
type PMRAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_REPORT'; payload: PMRReport | null }
  | { type: 'UPDATE_SECTION'; payload: { sectionId: string; content: any } }
  | { type: 'ADD_SECTION'; payload: PMRSection }
  | { type: 'REMOVE_SECTION'; payload: string }
  | { type: 'REORDER_SECTIONS'; payload: string[] }
  | { type: 'SET_INSIGHTS'; payload: AIInsight[] }
  | { type: 'UPDATE_INSIGHT'; payload: AIInsight }
  | { type: 'SET_MONTE_CARLO'; payload: MonteCarloResults }
  | { type: 'SET_COLLABORATION_SESSION'; payload: CollaborationSession | null }
  | { type: 'ADD_EXPORT_JOB'; payload: ExportJob }
  | { type: 'UPDATE_EXPORT_JOB'; payload: ExportJob }
  | { type: 'REMOVE_EXPORT_JOB'; payload: string }
  | { type: 'ADD_PENDING_CHANGE'; payload: { sectionId: string; content: any } }
  | { type: 'REMOVE_PENDING_CHANGE'; payload: string }
  | { type: 'CLEAR_PENDING_CHANGES' }
  | { type: 'SET_LAST_SYNC_TIME'; payload: Date }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'RESET_STATE' }

/**
 * Initial state
 */
const initialState: PMRContextState = {
  currentReport: null,
  isLoading: false,
  isSaving: false,
  error: null,
  collaborationSession: null,
  exportJobs: [],
  pendingChanges: new Map(),
  lastSyncTime: null,
  isOnline: true
}

/**
 * PMR Reducer
 */
function pmrReducer(state: PMRContextState, action: PMRAction): PMRContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    
    case 'SET_SAVING':
      return { ...state, isSaving: action.payload }
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false, isSaving: false }
    
    case 'SET_REPORT':
      return { ...state, currentReport: action.payload, error: null }
    
    case 'UPDATE_SECTION': {
      if (!state.currentReport) return state
      const updatedSections = state.currentReport.sections.map(section =>
        section.section_id === action.payload.sectionId
          ? { ...section, content: action.payload.content, last_modified: new Date().toISOString() }
          : section
      )
      return {
        ...state,
        currentReport: {
          ...state.currentReport,
          sections: updatedSections,
          last_modified: new Date().toISOString()
        }
      }
    }
    
    case 'ADD_SECTION': {
      if (!state.currentReport) return state
      return {
        ...state,
        currentReport: {
          ...state.currentReport,
          sections: [...state.currentReport.sections, action.payload],
          last_modified: new Date().toISOString()
        }
      }
    }
    
    case 'REMOVE_SECTION': {
      if (!state.currentReport) return state
      return {
        ...state,
        currentReport: {
          ...state.currentReport,
          sections: state.currentReport.sections.filter(s => s.section_id !== action.payload),
          last_modified: new Date().toISOString()
        }
      }
    }
    
    case 'REORDER_SECTIONS': {
      if (!state.currentReport) return state
      const sectionMap = new Map(state.currentReport.sections.map(s => [s.section_id, s]))
      const reorderedSections = action.payload
        .map(id => sectionMap.get(id))
        .filter((s): s is PMRSection => s !== undefined)
      return {
        ...state,
        currentReport: {
          ...state.currentReport,
          sections: reorderedSections,
          last_modified: new Date().toISOString()
        }
      }
    }
    
    case 'SET_INSIGHTS': {
      if (!state.currentReport) return state
      return {
        ...state,
        currentReport: {
          ...state.currentReport,
          ai_insights: action.payload
        }
      }
    }
    
    case 'UPDATE_INSIGHT': {
      if (!state.currentReport) return state
      const updatedInsights = state.currentReport.ai_insights.map(insight =>
        insight.id === action.payload.id ? action.payload : insight
      )
      return {
        ...state,
        currentReport: {
          ...state.currentReport,
          ai_insights: updatedInsights
        }
      }
    }
    
    case 'SET_MONTE_CARLO': {
      if (!state.currentReport) return state
      return {
        ...state,
        currentReport: {
          ...state.currentReport,
          monte_carlo_analysis: action.payload
        }
      }
    }
    
    case 'SET_COLLABORATION_SESSION':
      return { ...state, collaborationSession: action.payload }
    
    case 'ADD_EXPORT_JOB':
      return { ...state, exportJobs: [...state.exportJobs, action.payload] }
    
    case 'UPDATE_EXPORT_JOB': {
      const updatedJobs = state.exportJobs.map(job =>
        job.id === action.payload.id ? action.payload : job
      )
      return { ...state, exportJobs: updatedJobs }
    }
    
    case 'REMOVE_EXPORT_JOB':
      return { ...state, exportJobs: state.exportJobs.filter(job => job.id !== action.payload) }
    
    case 'ADD_PENDING_CHANGE': {
      const newPendingChanges = new Map(state.pendingChanges)
      newPendingChanges.set(action.payload.sectionId, action.payload.content)
      return { ...state, pendingChanges: newPendingChanges }
    }
    
    case 'REMOVE_PENDING_CHANGE': {
      const newPendingChanges = new Map(state.pendingChanges)
      newPendingChanges.delete(action.payload)
      return { ...state, pendingChanges: newPendingChanges }
    }
    
    case 'CLEAR_PENDING_CHANGES':
      return { ...state, pendingChanges: new Map() }
    
    case 'SET_LAST_SYNC_TIME':
      return { ...state, lastSyncTime: action.payload }
    
    case 'SET_ONLINE_STATUS':
      return { ...state, isOnline: action.payload }
    
    case 'RESET_STATE':
      return initialState
    
    default:
      return state
  }
}

/**
 * Create PMR Context
 */
const PMRContext = createContext<PMRContextType | undefined>(undefined)

/**
 * PMR Provider Props
 */
interface PMRProviderProps {
  children: React.ReactNode
  apiBaseUrl?: string
}

/**
 * PMR Provider Component
 */
export function PMRProvider({ children, apiBaseUrl = '/api' }: PMRProviderProps) {
  const [state, dispatch] = useReducer(pmrReducer, initialState)
  const lastOperationRef = useRef<(() => Promise<void>) | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef<number>(0)
  const maxRetries = 3

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true })
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false })
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auto-sync pending changes when coming back online
  useEffect(() => {
    if (state.isOnline && state.pendingChanges.size > 0) {
      syncPendingChanges()
    }
  }, [state.isOnline])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  /**
   * API Helper: Make authenticated request
   */
  const apiRequest = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> => {
    try {
      const response = await fetch(`${apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `API request failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API request error:', error)
      throw error
    }
  }, [apiBaseUrl])

  /**
   * Sync pending changes to server
   */
  const syncPendingChanges = useCallback(async () => {
    if (state.pendingChanges.size === 0 || !state.currentReport) return

    try {
      for (const [sectionId, content] of state.pendingChanges.entries()) {
        await apiRequest(`/reports/pmr/${state.currentReport.id}/sections/${sectionId}`, {
          method: 'PUT',
          body: JSON.stringify({ content })
        })
        dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: sectionId })
      }
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date() })
    } catch (error) {
      console.error('Failed to sync pending changes:', error)
    }
  }, [state.pendingChanges, state.currentReport, apiRequest])

  /**
   * Error handler with retry logic
   */
  const handleError = useCallback((error: any, operation?: () => Promise<void>) => {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    dispatch({ type: 'SET_ERROR', payload: errorMessage })
    
    if (operation) {
      lastOperationRef.current = operation
    }
    
    // Auto-retry for network errors
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        setTimeout(() => {
          if (lastOperationRef.current) {
            lastOperationRef.current()
          }
        }, 1000 * retryCountRef.current) // Exponential backoff
      }
    }
  }, [])

  /**
   * Load report by ID
   */
  const loadReport = useCallback(async (reportId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    
    const operation = async () => {
      try {
        const report = await apiRequest<PMRReport>(`/reports/pmr/${reportId}`)
        dispatch({ type: 'SET_REPORT', payload: report })
        dispatch({ type: 'SET_LOADING', payload: false })
        retryCountRef.current = 0
      } catch (error) {
        handleError(error, operation)
      }
    }
    
    await operation()
  }, [apiRequest, handleError])

  /**
   * Create new report
   */
  const createReport = useCallback(async (request: PMRGenerationRequest): Promise<string> => {
    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })
    
    try {
      const response = await apiRequest<{ id: string; status: string }>('/reports/pmr/generate', {
        method: 'POST',
        body: JSON.stringify(request)
      })
      dispatch({ type: 'SET_LOADING', payload: false })
      return response.id
    } catch (error) {
      handleError(error)
      throw error
    }
  }, [apiRequest, handleError])

  /**
   * Update report
   */
  const updateReport = useCallback(async (updates: Partial<PMRReport>) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    dispatch({ type: 'SET_SAVING', payload: true })
    
    try {
      const updatedReport = await apiRequest<PMRReport>(
        `/reports/pmr/${state.currentReport.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates)
        }
      )
      dispatch({ type: 'SET_REPORT', payload: updatedReport })
      dispatch({ type: 'SET_SAVING', payload: false })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Delete report
   */
  const deleteReport = useCallback(async (reportId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      await apiRequest(`/reports/pmr/${reportId}`, { method: 'DELETE' })
      dispatch({ type: 'RESET_STATE' })
    } catch (error) {
      handleError(error)
    }
  }, [apiRequest, handleError])

  /**
   * Update section with optimistic updates
   */
  const updateSection = useCallback(async (sectionId: string, content: any) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    // Optimistic update
    dispatch({ type: 'UPDATE_SECTION', payload: { sectionId, content } })
    
    // Queue for sync if offline
    if (!state.isOnline) {
      dispatch({ type: 'ADD_PENDING_CHANGE', payload: { sectionId, content } })
      return
    }
    
    try {
      await apiRequest(`/reports/pmr/${state.currentReport.id}/sections/${sectionId}`, {
        method: 'PUT',
        body: JSON.stringify({ content })
      })
      dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date() })
    } catch (error) {
      // Revert optimistic update on error
      dispatch({ type: 'ADD_PENDING_CHANGE', payload: { sectionId, content } })
      handleError(error)
    }
  }, [state.currentReport, state.isOnline, apiRequest, handleError])

  /**
   * Add new section
   */
  const addSection = useCallback(async (
    section: Omit<PMRSection, 'last_modified' | 'modified_by'>
  ) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    const newSection: PMRSection = {
      ...section,
      last_modified: new Date().toISOString(),
      modified_by: 'current_user' // Should come from auth context
    }
    
    dispatch({ type: 'ADD_SECTION', payload: newSection })
    
    try {
      await apiRequest(`/reports/pmr/${state.currentReport.id}/sections`, {
        method: 'POST',
        body: JSON.stringify(newSection)
      })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Remove section
   */
  const removeSection = useCallback(async (sectionId: string) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    dispatch({ type: 'REMOVE_SECTION', payload: sectionId })
    
    try {
      await apiRequest(`/reports/pmr/${state.currentReport.id}/sections/${sectionId}`, {
        method: 'DELETE'
      })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Reorder sections
   */
  const reorderSections = useCallback(async (sectionIds: string[]) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    dispatch({ type: 'REORDER_SECTIONS', payload: sectionIds })
    
    try {
      await apiRequest(`/reports/pmr/${state.currentReport.id}/sections/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ section_ids: sectionIds })
      })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Generate AI insights
   */
  const generateInsights = useCallback(async (categories?: string[]) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      const response = await apiRequest<{ insights: AIInsight[] }>(
        `/reports/pmr/${state.currentReport.id}/insights/generate`,
        {
          method: 'POST',
          body: JSON.stringify({ categories })
        }
      )
      dispatch({ type: 'SET_INSIGHTS', payload: response.insights })
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Validate insight
   */
  const validateInsight = useCallback(async (
    insightId: string,
    isValid: boolean,
    notes?: string
  ) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    const insight = state.currentReport.ai_insights.find(i => i.id === insightId)
    if (!insight) return
    
    const updatedInsight: AIInsight = {
      ...insight,
      validated: isValid,
      validation_notes: notes
    }
    
    dispatch({ type: 'UPDATE_INSIGHT', payload: updatedInsight })
    
    try {
      await apiRequest(`/reports/pmr/${state.currentReport.id}/insights/${insightId}/validate`, {
        method: 'POST',
        body: JSON.stringify({ is_valid: isValid, notes })
      })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Provide feedback on insight
   */
  const provideFeedback = useCallback(async (
    insightId: string,
    feedback: 'helpful' | 'not_helpful'
  ) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    const insight = state.currentReport.ai_insights.find(i => i.id === insightId)
    if (!insight) return
    
    const updatedInsight: AIInsight = {
      ...insight,
      user_feedback: feedback
    }
    
    dispatch({ type: 'UPDATE_INSIGHT', payload: updatedInsight })
    
    try {
      await apiRequest(`/reports/pmr/${state.currentReport.id}/insights/${insightId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback })
      })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Filter insights
   */
  const filterInsights = useCallback((filters: InsightFilters): AIInsight[] => {
    if (!state.currentReport) return []
    
    return state.currentReport.ai_insights.filter(insight => {
      if (filters.categories.length > 0 && !filters.categories.includes(insight.category)) {
        return false
      }
      if (filters.types.length > 0 && !filters.types.includes(insight.type)) {
        return false
      }
      if (filters.priorities.length > 0 && !filters.priorities.includes(insight.priority)) {
        return false
      }
      if (filters.validated !== null && insight.validated !== filters.validated) {
        return false
      }
      if (insight.confidence_score < filters.minConfidence) {
        return false
      }
      return true
    })
  }, [state.currentReport])

  /**
   * Run Monte Carlo analysis
   */
  const runMonteCarloAnalysis = useCallback(async (params: any) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    dispatch({ type: 'SET_LOADING', payload: true })
    
    try {
      const results = await apiRequest<MonteCarloResults>(
        `/reports/pmr/${state.currentReport.id}/monte-carlo`,
        {
          method: 'POST',
          body: JSON.stringify(params)
        }
      )
      dispatch({ type: 'SET_MONTE_CARLO', payload: results })
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Send chat-based edit request
   */
  const sendChatEdit = useCallback(async (request: ChatEditRequest): Promise<ChatEditResponse> => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    try {
      const response = await apiRequest<ChatEditResponse>(
        `/reports/pmr/${state.currentReport.id}/edit/chat`,
        {
          method: 'POST',
          body: JSON.stringify(request)
        }
      )
      
      // Apply changes from chat response
      for (const change of response.changes_applied) {
        dispatch({ type: 'UPDATE_SECTION', payload: { 
          sectionId: change.section_id, 
          content: change.new_content 
        }})
      }
      
      return response
    } catch (error) {
      handleError(error)
      throw error
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Export report
   */
  const exportReport = useCallback(async (
    format: 'pdf' | 'excel' | 'slides' | 'word',
    options?: any
  ): Promise<string> => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    try {
      const response = await apiRequest<{ export_job_id: string }>(
        `/reports/pmr/${state.currentReport.id}/export`,
        {
          method: 'POST',
          body: JSON.stringify({ format, options })
        }
      )
      
      const exportJob: ExportJob = {
        id: response.export_job_id,
        report_id: state.currentReport.id,
        export_format: format,
        template_config: options?.template || {},
        export_options: options || {},
        status: 'queued',
        requested_by: 'current_user',
        started_at: new Date().toISOString()
      }
      
      dispatch({ type: 'ADD_EXPORT_JOB', payload: exportJob })
      
      return response.export_job_id
    } catch (error) {
      handleError(error)
      throw error
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * Get export status
   */
  const getExportStatus = useCallback(async (jobId: string): Promise<ExportJob> => {
    try {
      const job = await apiRequest<ExportJob>(`/reports/pmr/export/${jobId}`)
      dispatch({ type: 'UPDATE_EXPORT_JOB', payload: job })
      return job
    } catch (error) {
      handleError(error)
      throw error
    }
  }, [apiRequest, handleError])

  /**
   * Cancel export
   */
  const cancelExport = useCallback(async (jobId: string) => {
    try {
      await apiRequest(`/reports/pmr/export/${jobId}`, { method: 'DELETE' })
      dispatch({ type: 'REMOVE_EXPORT_JOB', payload: jobId })
    } catch (error) {
      handleError(error)
    }
  }, [apiRequest, handleError])

  /**
   * Start collaboration session
   */
  const startCollaboration = useCallback(async (participants: string[]) => {
    if (!state.currentReport) {
      throw new Error('No report loaded')
    }
    
    try {
      const session = await apiRequest<CollaborationSession>(
        `/reports/pmr/${state.currentReport.id}/collaborate`,
        {
          method: 'POST',
          body: JSON.stringify({ participants })
        }
      )
      dispatch({ type: 'SET_COLLABORATION_SESSION', payload: session })
    } catch (error) {
      handleError(error)
    }
  }, [state.currentReport, apiRequest, handleError])

  /**
   * End collaboration session
   */
  const endCollaboration = useCallback(async () => {
    if (!state.collaborationSession) return
    
    try {
      await apiRequest(
        `/reports/pmr/${state.collaborationSession.report_id}/collaborate/${state.collaborationSession.session_id}`,
        { method: 'DELETE' }
      )
      dispatch({ type: 'SET_COLLABORATION_SESSION', payload: null })
    } catch (error) {
      handleError(error)
    }
  }, [state.collaborationSession, apiRequest, handleError])

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
    retryCountRef.current = 0
  }, [])

  /**
   * Retry last operation
   */
  const retryLastOperation = useCallback(async () => {
    if (lastOperationRef.current) {
      retryCountRef.current = 0
      await lastOperationRef.current()
    }
  }, [])

  /**
   * Apply optimistic update
   */
  const applyOptimisticUpdate = useCallback((sectionId: string, content: any) => {
    dispatch({ type: 'UPDATE_SECTION', payload: { sectionId, content } })
    dispatch({ type: 'ADD_PENDING_CHANGE', payload: { sectionId, content } })
  }, [])

  /**
   * Revert optimistic update
   */
  const revertOptimisticUpdate = useCallback((sectionId: string) => {
    dispatch({ type: 'REMOVE_PENDING_CHANGE', payload: sectionId })
    // Reload the section from server
    if (state.currentReport) {
      loadReport(state.currentReport.id)
    }
  }, [state.currentReport, loadReport])

  // Context value
  const contextValue: PMRContextType = {
    state,
    actions: {
      loadReport,
      createReport,
      updateReport,
      deleteReport,
      updateSection,
      addSection,
      removeSection,
      reorderSections,
      generateInsights,
      validateInsight,
      provideFeedback,
      filterInsights,
      runMonteCarloAnalysis,
      sendChatEdit,
      exportReport,
      getExportStatus,
      cancelExport,
      startCollaboration,
      endCollaboration,
      clearError,
      retryLastOperation,
      applyOptimisticUpdate,
      revertOptimisticUpdate
    }
  }

  return (
    <PMRContext.Provider value={contextValue}>
      {children}
    </PMRContext.Provider>
  )
}

/**
 * Custom hook to use PMR context
 */
export function usePMRContext() {
  const context = useContext(PMRContext)
  if (context === undefined) {
    throw new Error('usePMRContext must be used within a PMRProvider')
  }
  return context
}

export default PMRProvider
