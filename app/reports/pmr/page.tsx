'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../providers/SupabaseAuthProvider'
import AppLayout from '../../../components/shared/AppLayout'
import AIInsightsPanel from '../../../components/pmr/AIInsightsPanel'
import CollaborationPanel from '../../../components/pmr/CollaborationPanel'
import CursorTracker from '../../../components/pmr/CursorTracker'
import ConflictResolutionModal from '../../../components/pmr/ConflictResolutionModal'
import { useRealtimePMR } from '../../../hooks/useRealtimePMR'
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
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import type { 
  PMRReport, 
  AIInsight,
  Conflict
} from '../../../components/pmr/types'

export default function EnhancedPMRPage() {
  const { session, user } = useAuth()
  
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
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  
  // Container ref for cursor tracking
  const containerRef = useRef<HTMLDivElement>(null)

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
        return 'bg-gray-100 text-gray-800'
      case 'review':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'distributed':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Please sign in to access Enhanced PMR</p>
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
            <Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading report...</p>
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
            <p className="text-red-600 mb-4">{reportError}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div ref={containerRef} className="h-full flex flex-col bg-gray-50">
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

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
            <div className="flex items-center space-x-3 min-w-0">
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                  {currentReport?.title || 'Enhanced PMR'}
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(currentReport?.status || 'draft')}`}>
                    {currentReport?.status || 'draft'}
                  </span>
                  {lastSaved && (
                    <span className="text-xs text-gray-500 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Saved {lastSaved.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {/* WebSocket Status */}
              <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-gray-100">
                <div className={`w-2 h-2 rounded-full ${
                  realtimeState.isConnected 
                    ? 'bg-green-500' 
                    : realtimeState.isReconnecting 
                    ? 'bg-yellow-500 animate-pulse' 
                    : 'bg-red-500'
                }`} />
                <span className="text-xs text-gray-600 hidden sm:inline">
                  {realtimeState.isConnected 
                    ? 'Connected' 
                    : realtimeState.isReconnecting 
                    ? 'Reconnecting...' 
                    : 'Disconnected'}
                </span>
              </div>
              
              {/* Active Users */}
              {realtimeState.activeUsers.length > 0 && (
                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-gray-100">
                  <Users className="h-4 w-4 text-gray-600" />
                  <span className="text-xs text-gray-600">{realtimeState.activeUsers.length}</span>
                </div>
              )}
              
              {/* Conflicts Badge */}
              {realtimeState.conflicts.filter(c => !c.resolved).length > 0 && (
                <div className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-red-100">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-red-600">
                    {realtimeState.conflicts.filter(c => !c.resolved).length}
                  </span>
                </div>
              )}
              
              <button
                onClick={handleSaveReport}
                disabled={isSaving}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {isSaving ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Save</span>
              </button>
              
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mobile Panel Selector */}
          {isMobile && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 z-10">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActivePanel('editor')}
                  className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-sm ${
                    activePanel === 'editor' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Editor</span>
                </button>
                <button
                  onClick={() => setActivePanel('insights')}
                  className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-sm ${
                    activePanel === 'insights' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span>Insights</span>
                </button>
                <button
                  onClick={() => setActivePanel('collaboration')}
                  className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-sm ${
                    activePanel === 'collaboration' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Collab</span>
                </button>
              </div>
            </div>
          )}

          {/* Editor Panel */}
          <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${isMobile && activePanel !== 'editor' ? 'hidden' : ''}`}>
            <div className="max-w-4xl mx-auto">
              {currentReport?.sections.map((section) => (
                <div key={section.section_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                    {section.ai_generated && section.confidence_score && (
                      <span className="text-xs text-gray-500">
                        AI Generated ({Math.round(section.confidence_score * 100)}% confidence)
                      </span>
                    )}
                  </div>
                  <div className="prose max-w-none">
                    <p className="text-gray-700">{section.content}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <span>Last modified: {new Date(section.last_modified).toLocaleString()}</span>
                    <button className="text-blue-600 hover:text-blue-800">
                      <Edit3 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              {(!currentReport?.sections || currentReport.sections.length === 0) && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No sections available</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Insights Panel */}
          <div className={`${isMobile ? (activePanel === 'insights' ? 'w-full' : 'hidden') : 'w-96'}`}>
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

          {/* Collaboration Panel */}
          {((!isMobile) || (isMobile && activePanel === 'collaboration')) && (
            <div className={`${isMobile ? 'w-full' : 'w-80'} border-l border-gray-200`}>
              <CollaborationPanel
                activeUsers={realtimeState.activeUsers}
                comments={realtimeState.comments}
                conflicts={realtimeState.conflicts}
                currentUserId={user?.id || ''}
                onAddComment={realtimeActions.addComment}
                onResolveComment={realtimeActions.resolveComment}
                onResolveConflict={realtimeActions.resolveConflict}
                className="h-full"
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
