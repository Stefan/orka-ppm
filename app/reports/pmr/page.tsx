'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../providers/SupabaseAuthProvider'
import { useTranslations } from '../../../lib/i18n/context'
import { debugIngest } from '@/lib/debug-ingest'
import AppLayout from '../../../components/shared/AppLayout'
import AIInsightsPanel from '../../../components/pmr/AIInsightsPanel'
import CollaborationPanel from '../../../components/pmr/CollaborationPanel'
import CursorTracker from '../../../components/pmr/CursorTracker'
import ConflictResolutionModal from '../../../components/pmr/ConflictResolutionModal'
import PMRHelpIntegration from '../../../components/pmr/PMRHelpIntegration'
import ContextualHelp from '../../../components/pmr/ContextualHelp'
import { useRealtimePMR } from '../../../hooks/useRealtimePMR'
import { getPMRHelpContent } from '../../../lib/pmr-help-content'
import { 
  FileText, 
  Loader, 
  Users, 
  Download,
  Settings,
  Save,
  Eye,
  Edit3,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  HelpCircle
} from 'lucide-react'
import type { 
  PMRReport, 
  AIInsight,
  Conflict
} from '../../../components/pmr/types'

export default function EnhancedPMRPage() {
  const { session, user } = useAuth()
  const { t, locale } = useTranslations()
  
  // Report state
  const [currentReport, setCurrentReport] = useState<PMRReport | null>(null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  
  // AI Insights state
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false)
  
  // Conflict resolution state
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  const [showConflictModal, setShowConflictModal] = useState(false)
  
  // UI state
  const [activePanel, setActivePanel] = useState<'editor' | 'insights' | 'collaboration'>('editor')
  const [sidebarPanel, setSidebarPanel] = useState<'insights' | 'collaboration'>('insights')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Container ref for cursor tracking
  const containerRef = useRef<HTMLDivElement>(null)
  const mainContentAreaRef = useRef<HTMLDivElement>(null)

  // Real-time collaboration hook
  const [realtimeState, realtimeActions] = useRealtimePMR({
    reportId: currentReport?.id || '',
    userId: user?.id || '',
    userName: user?.email || 'Anonymous',
    userEmail: user?.email,
    accessToken: session?.access_token || '',
    onSectionUpdate: (sectionId, content, userId) => {
      setCurrentReport(prev => {
        if (!prev) return prev
        
        return {
          ...prev,
          sections: prev.sections.map(section => 
            section.section_id === sectionId
              ? { ...section, content, last_modified: new Date().toISOString(), modified_by: userId }
              : section
          )
        }
      })
    },
    onConflictDetected: (conflict) => {
      setSelectedConflict(conflict)
      setShowConflictModal(true)
    }
  })

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // #region agent log
  useEffect(() => {
    const container = containerRef.current
    const mainArea = mainContentAreaRef.current
    if (!container) return
    const log = () => {
      const c = containerRef.current
      const m = mainContentAreaRef.current
      if (!c) return
      const data: Record<string, unknown> = { containerOffsetHeight: c.offsetHeight, containerScrollHeight: c.scrollHeight, isMobile, activePanel }
      if (m) { data.mainAreaOffsetHeight = m.offsetHeight; data.mainAreaScrollHeight = m.scrollHeight }
      debugIngest({ location: 'app/reports/pmr/page.tsx:container', message: 'PMR layout metrics', data, sessionId: 'debug-session', hypothesisId: 'H4' })
      debugIngest({ location: 'app/reports/pmr/page.tsx:container', message: 'PMR layout metrics', data, sessionId: 'debug-session', hypothesisId: 'H5' })
    }
    const t = setTimeout(log, 100)
    const ro = mainArea ? new ResizeObserver(log) : null
    if (mainArea) ro?.observe(mainArea)
    return () => { clearTimeout(t); ro && mainArea && ro.disconnect() }
  }, [isMobile, activePanel])
  // #endregion

  // Load initial report (mock for now)
  useEffect(() => {
    if (!session?.access_token) return
    
    // For now, create a mock report
    // In production, this would fetch from the API
    const mockReport: PMRReport = {
      id: 'report-1',
      project_id: 'project-1',
      title: 'January 2026 Project Monthly Report',
      report_month: '2026-01',
      report_year: 2026,
      status: 'draft',
      sections: [
        {
          section_id: 'executive-summary',
          title: 'Executive Summary',
          content: 'This is the executive summary section...',
          ai_generated: true,
          confidence_score: 0.92,
          last_modified: new Date().toISOString(),
          modified_by: user?.id || 'system'
        },
        {
          section_id: 'budget-status',
          title: 'Budget Status',
          content: 'Budget performance analysis...',
          ai_generated: true,
          confidence_score: 0.88,
          last_modified: new Date().toISOString(),
          modified_by: user?.id || 'system'
        }
      ],
      ai_insights: [],
      real_time_metrics: {},
      confidence_scores: {},
      template_customizations: {},
      generated_by: user?.id || 'system',
      generated_at: new Date().toISOString(),
      last_modified: new Date().toISOString(),
      version: 1
    }
    
    setCurrentReport(mockReport)
  }, [session, user])

  // AI Insights handlers
  const handleGenerateInsights = useCallback(async (categories?: string[]) => {
    if (!currentReport) return
    
    setIsGeneratingInsights(true)
    
    try {
      // Mock insights generation
      // In production, this would call the API
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mockInsights: AIInsight[] = [
        {
          id: 'insight-1',
          type: 'alert',
          category: 'budget',
          title: 'Budget Variance Alert',
          content: 'Project is trending 5% over budget. Recommend reviewing resource allocation.',
          confidence_score: 0.87,
          supporting_data: { variance: 5.2, trend: 'increasing' },
          predicted_impact: 'Potential $15,000 overrun by end of quarter',
          recommended_actions: [
            'Review and optimize resource allocation',
            'Identify non-critical tasks for deferral',
            'Consider scope adjustment discussions'
          ],
          priority: 'high',
          generated_at: new Date().toISOString(),
          validated: false
        },
        {
          id: 'insight-2',
          type: 'prediction',
          category: 'schedule',
          title: 'Timeline Forecast',
          content: 'Based on current velocity, project completion is predicted for March 15, 2026.',
          confidence_score: 0.92,
          supporting_data: { velocity: 0.85, remaining_work: 120 },
          predicted_impact: 'On track for on-time delivery',
          recommended_actions: [
            'Maintain current resource levels',
            'Monitor critical path activities'
          ],
          priority: 'medium',
          generated_at: new Date().toISOString(),
          validated: false
        }
      ]
      
      setInsights(mockInsights)
    } catch (error) {
      console.error('Error generating insights:', error)
    } finally {
      setIsGeneratingInsights(false)
    }
  }, [currentReport])

  const handleInsightValidate = useCallback((insightId: string, isValid: boolean, notes?: string) => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId
        ? { ...insight, validated: isValid, validation_notes: notes }
        : insight
    ))
  }, [])

  const handleInsightApply = useCallback((insightId: string) => {
    console.log('Applying insight:', insightId)
    // In production, this would apply the insight's recommendations
  }, [])

  const handleInsightFeedback = useCallback((insightId: string, feedback: 'helpful' | 'not_helpful') => {
    setInsights(prev => prev.map(insight => 
      insight.id === insightId
        ? { ...insight, user_feedback: feedback }
        : insight
    ))
  }, [])

  // Save report
  const handleSaveReport = useCallback(async () => {
    if (!currentReport) return
    
    setIsSaving(true)
    
    try {
      // In production, this would save to the API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setLastSaved(new Date())
    } catch (error) {
      console.error('Error saving report:', error)
    } finally {
      setIsSaving(false)
    }
  }, [currentReport])

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
      case 'review':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      case 'distributed':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
      default:
        return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200'
    }
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-slate-400">{t('pmr.page.signInRequired')}</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (isLoadingReport) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader className="h-12 w-12 text-blue-600 dark:text-blue-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-slate-400">{t('pmr.page.loadingReport')}</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (reportError) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400 mb-4">{reportError}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('pmr.page.retry')}
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div ref={containerRef} className="h-full flex flex-col bg-gray-50 dark:bg-slate-800/50">
        {/* Help Integration */}
        <PMRHelpIntegration
          enableOnboarding={true}
          enableContextualHelp={true}
          enableAITooltips={true}
          onHelpInteraction={(type, action) => {
            console.log('Help interaction:', type, action)
          }}
        />

        {/* Cursor Tracker */}
        <CursorTracker
          cursors={realtimeState.cursors}
          currentUserId={user?.id || ''}
          containerRef={containerRef}
        />

        {/* Conflict Resolution Modal */}
        {selectedConflict && (
          <ConflictResolutionModal
            conflict={selectedConflict}
            isOpen={showConflictModal}
            onClose={() => {
              setShowConflictModal(false)
              setSelectedConflict(null)
            }}
            onResolve={realtimeActions.resolveConflict}
          />
        )}

        {/* Header: left = title + status, right = actions only */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
                  {currentReport?.report_month
                    ? (() => {
                        const [y, m] = currentReport.report_month.split('-').map(Number)
                        const monthName = new Date(y, m - 1, 1).toLocaleString(locale, { month: 'long' })
                        return t('pmr.placeholderContent.reportTitleTemplate', { month: monthName, year: currentReport.report_year })
                      })()
                    : (currentReport?.title || t('pmr.page.title'))}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentReport?.status || 'draft')}`}>
                    {t(`pmr.status.${currentReport?.status || 'draft'}`)}
                  </span>
                  {lastSaved && (
                    <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                      {t('pmr.connection.saved', { time: lastSaved.toLocaleTimeString() })}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        realtimeState.isConnected ? 'bg-green-500' : realtimeState.isReconnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-gray-600 dark:text-slate-300 hidden sm:inline">
                        {realtimeState.isConnected ? t('pmr.connection.connected') : realtimeState.isReconnecting ? t('pmr.connection.reconnecting') : t('pmr.connection.disconnected')}
                      </span>
                    </div>
                    {realtimeState.activeUsers.length > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700" data-tour="collaboration">
                        <Users className="h-3.5 w-3.5 text-gray-600 dark:text-slate-300" />
                        <span className="text-xs text-gray-600 dark:text-slate-300">{realtimeState.activeUsers.length}</span>
                        <ContextualHelp content={getPMRHelpContent('collaboration')!} position="bottom" trigger="hover" iconClassName="h-3 w-3" />
                      </div>
                    )}
                    {realtimeState.conflicts.filter(c => !c.resolved).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const first = realtimeState.conflicts.find(c => !c.resolved)
                          if (first) setSelectedConflict(first)
                          setShowConflictModal(true)
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-800 dark:text-red-400 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {realtimeState.conflicts.filter(c => !c.resolved).length}
                        <ContextualHelp content={getPMRHelpContent('conflicts')!} position="bottom" trigger="hover" iconClassName="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSaveReport}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                {isSaving ? <Loader className="h-4 w-4 animate-spin shrink-0" /> : <Save className="h-4 w-4 shrink-0" />}
                <span className="hidden sm:inline">{isSaving ? t('pmr.actions.saving') : t('pmr.actions.save')}</span>
              </button>
              <span className="inline-flex items-center gap-2" data-tour="export">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100 hover:bg-gray-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{t('pmr.actions.export')}</span>
                </button>
                <ContextualHelp content={getPMRHelpContent('export')!} position="bottom" trigger="hover" iconClassName="h-4 w-4 text-gray-500 dark:text-slate-400" />
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Area: desktop = sections left + sidebar right; mobile = tabs then content */}
        <div ref={mainContentAreaRef} className="flex-1 min-w-0 w-full flex flex-col md:flex-row overflow-hidden">
          {/* Mobile Panel Selector */}
          {isMobile && (
            <div className="sticky top-0 z-10 flex-shrink-0 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 p-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setActivePanel('editor')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    activePanel === 'editor' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Edit3 className="h-4 w-4 shrink-0" />
                  <span>{t('pmr.panels.editor')}</span>
                </button>
                <button
                  onClick={() => setActivePanel('insights')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    activePanel === 'insights' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Eye className="h-4 w-4 shrink-0" />
                  <span>{t('pmr.panels.insights')}</span>
                </button>
                <button
                  onClick={() => setActivePanel('collaboration')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    activePanel === 'collaboration' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                  data-tour="preview"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span>{t('pmr.panels.collaboration')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Left: Report sections (scrollable on desktop, with panels below on mobile) */}
          <div className={`flex-1 min-w-0 overflow-y-auto ${isMobile && activePanel !== 'editor' ? 'hidden' : ''} px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10`} data-tour="editor">
            <div className={`${!isMobile ? 'max-w-3xl mx-auto' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{t('pmr.page.reportSections')}</h2>
                <ContextualHelp
                  content={getPMRHelpContent('editor')!}
                  position="left"
                  trigger="click"
                />
              </div>

              {currentReport?.sections.map((section) => {
                const sectionTitle =
                  section.section_id === 'executive-summary'
                    ? t('pmr.sections.executive-summary')
                    : section.section_id === 'budget-status'
                      ? t('pmr.sections.budget-status')
                      : section.title
                // #region agent log
                const sectionKey = section.section_id === 'executive-summary' ? 'pmr.sections.executive-summary' : section.section_id === 'budget-status' ? 'pmr.sections.budget-status' : null;
                if (sectionKey) { debugIngest({ location: 'app/reports/pmr/page.tsx:sectionTitle', message: 'PMR section title', data: { section_id: section.section_id, key: sectionKey, sectionTitle }, sessionId: 'debug-session', hypothesisId: 'H3' }); }
                // #endregion
                const sectionContent =
                  section.section_id === 'executive-summary'
                    ? t('pmr.placeholderContent.executive-summary')
                    : section.section_id === 'budget-status'
                      ? t('pmr.placeholderContent.budget-status')
                      : section.content
                return (
                <div key={section.section_id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 pt-0.5">{sectionTitle}</h2>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 flex-shrink-0"
                      aria-label={t('common.edit')}
                    >
                      <Edit3 className="h-4 w-4 shrink-0" />
                      <span>{t('common.edit')}</span>
                    </button>
                  </div>
                  {section.ai_generated && section.confidence_score && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                      {t('pmr.page.aiGenerated')} ({t('pmr.page.confidence', { percent: Math.round(section.confidence_score * 100) })})
                    </p>
                  )}
                  <div className="prose max-w-none dark:prose-invert">
                    <p className="text-gray-700 dark:text-slate-300">{sectionContent}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
                    {t('pmr.page.lastModified')}: {new Date(section.last_modified).toLocaleString()}
                  </div>
                </div>
              )})}

              {(!currentReport?.sections || currentReport.sections.length === 0) && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-slate-400">{t('pmr.page.noSections')}</p>
                </div>
              )}

              {/* Mobile only: AI Insights & Collaboration below sections */}
              {isMobile && (
                <div className="grid grid-cols-1 gap-4 mt-6">
                  <div className="flex flex-col min-h-[20rem] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden" data-tour="ai-insights">
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('pmr.page.aiInsights')}</h3>
                      <ContextualHelp content={getPMRHelpContent('aiInsights')!} position="left" trigger="hover" iconClassName="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <AIInsightsPanel
                        insights={insights}
                        onInsightValidate={handleInsightValidate}
                        onInsightApply={handleInsightApply}
                        onGenerateInsights={handleGenerateInsights}
                        onInsightFeedback={handleInsightFeedback}
                        isLoading={isGeneratingInsights}
                        className="h-full"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col min-h-[20rem] border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
                    <CollaborationPanel
                      activeUsers={realtimeState.activeUsers}
                      comments={realtimeState.comments}
                      conflicts={realtimeState.conflicts}
                      currentUserId={user?.id || ''}
                      onAddComment={realtimeActions.addComment}
                      onResolveComment={realtimeActions.resolveComment}
                      onResolveConflict={realtimeActions.resolveConflict}
                      className="flex-1 min-h-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop: fixed right sidebar (Insights | Collaboration) */}
          {!isMobile && (
            <aside className="w-96 flex-shrink-0 border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col min-h-0">
              <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700 p-2">
                <button
                  onClick={() => setSidebarPanel('insights')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    sidebarPanel === 'insights' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                  data-tour="ai-insights"
                >
                  <Eye className="h-4 w-4 shrink-0" />
                  <span>{t('pmr.panels.insights')}</span>
                </button>
                <button
                  onClick={() => setSidebarPanel('collaboration')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    sidebarPanel === 'collaboration' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span>{t('pmr.panels.collaboration')}</span>
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {sidebarPanel === 'insights' && (
                  <>
                    <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('pmr.page.aiInsights')}</h3>
                      <ContextualHelp content={getPMRHelpContent('aiInsights')!} position="left" trigger="hover" iconClassName="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-h-0 overflow-auto">
                      <AIInsightsPanel
                        insights={insights}
                        onInsightValidate={handleInsightValidate}
                        onInsightApply={handleInsightApply}
                        onGenerateInsights={handleGenerateInsights}
                        onInsightFeedback={handleInsightFeedback}
                        isLoading={isGeneratingInsights}
                        className="h-full"
                      />
                    </div>
                  </>
                )}
                {sidebarPanel === 'collaboration' && (
                  <div className="flex-1 min-h-0 overflow-auto flex flex-col">
                    <CollaborationPanel
                      activeUsers={realtimeState.activeUsers}
                      comments={realtimeState.comments}
                      conflicts={realtimeState.conflicts}
                      currentUserId={user?.id || ''}
                      onAddComment={realtimeActions.addComment}
                      onResolveComment={realtimeActions.resolveComment}
                      onResolveConflict={realtimeActions.resolveConflict}
                      className="flex-1 min-h-0"
                    />
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Mobile: only Insights panel (full view) */}
          {isMobile && activePanel === 'insights' && (
            <div className="flex-1 min-h-0 flex flex-col p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{t('pmr.page.aiInsights')}</h3>
                <ContextualHelp content={getPMRHelpContent('aiInsights')!} position="left" trigger="hover" iconClassName="h-4 w-4" />
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <AIInsightsPanel
                  insights={insights}
                  onInsightValidate={handleInsightValidate}
                  onInsightApply={handleInsightApply}
                  onGenerateInsights={handleGenerateInsights}
                  onInsightFeedback={handleInsightFeedback}
                  isLoading={isGeneratingInsights}
                  className="h-full"
                />
              </div>
            </div>
          )}

          {/* Mobile: only Collaboration panel */}
          {isMobile && activePanel === 'collaboration' && (
            <div className="flex-1 min-h-0 flex flex-col p-4 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg overflow-hidden">
              <CollaborationPanel
                activeUsers={realtimeState.activeUsers}
                comments={realtimeState.comments}
                conflicts={realtimeState.conflicts}
                currentUserId={user?.id || ''}
                onAddComment={realtimeActions.addComment}
                onResolveComment={realtimeActions.resolveComment}
                onResolveConflict={realtimeActions.resolveConflict}
                className="flex-1 min-h-0"
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
