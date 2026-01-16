/**
 * PMR Context Usage Examples
 * 
 * This file demonstrates how to use the PMR Context and hooks
 */

import React, { useEffect, useState } from 'react'
import { PMRProvider, usePMRContext } from './PMRContext'
import { usePMRContext as useEnhancedPMRContext } from '@/hooks/usePMRContext'

/**
 * Example 1: Basic Report Loading
 */
function ReportViewer({ reportId }: { reportId: string }) {
  const { state, actions } = usePMRContext()

  useEffect(() => {
    actions.loadReport(reportId)
  }, [reportId])

  if (state.isLoading) {
    return <div>Loading report...</div>
  }

  if (state.error) {
    return (
      <div>
        <p>Error: {state.error}</p>
        <button onClick={actions.retryLastOperation}>Retry</button>
      </div>
    )
  }

  if (!state.currentReport) {
    return <div>No report loaded</div>
  }

  return (
    <div>
      <h1>{state.currentReport.title}</h1>
      <p>Status: {state.currentReport.status}</p>
      <p>Sections: {state.currentReport.sections.length}</p>
    </div>
  )
}

/**
 * Example 2: Section Editing with Optimistic Updates
 */
function SectionEditor({ sectionId }: { sectionId: string }) {
  const { state, actions } = usePMRContext()
  const [content, setContent] = useState('')

  const section = state.currentReport?.sections.find(s => s.section_id === sectionId)

  useEffect(() => {
    if (section) {
      setContent(section.content.text || '')
    }
  }, [section])

  const handleSave = async () => {
    await actions.updateSection(sectionId, { text: content })
  }

  return (
    <div>
      <h2>{section?.title}</h2>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={state.isSaving}
      />
      <button onClick={handleSave} disabled={state.isSaving}>
        {state.isSaving ? 'Saving...' : 'Save'}
      </button>
      {!state.isOnline && <p>⚠️ Offline - changes will sync when online</p>}
    </div>
  )
}

/**
 * Example 3: AI Insights Panel
 */
function AIInsightsPanel() {
  const { getInsights, getHighPriorityInsights, actions } = useEnhancedPMRContext()

  const allInsights = getInsights()
  const highPriorityInsights = getHighPriorityInsights()

  const handleValidate = async (insightId: string, isValid: boolean) => {
    await actions.validateInsight(insightId, isValid)
  }

  return (
    <div>
      <h2>AI Insights</h2>
      
      {highPriorityInsights.length > 0 && (
        <div>
          <h3>High Priority</h3>
          {highPriorityInsights.map(insight => (
            <div key={insight.id}>
              <h4>{insight.title}</h4>
              <p>{insight.content}</p>
              <p>Confidence: {(insight.confidence_score * 100).toFixed(0)}%</p>
              <button onClick={() => handleValidate(insight.id, true)}>
                Validate
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3>All Insights ({allInsights.length})</h3>
        {allInsights.map(insight => (
          <div key={insight.id}>
            <p>{insight.title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Example 4: Export Manager
 */
function ExportManager() {
  const { exportJobs, activeExportJobs, actions } = useEnhancedPMRContext()
  const [progress, setProgress] = useState(0)

  const handleExport = async (format: 'pdf' | 'excel' | 'slides' | 'word') => {
    try {
      await actions.exportWithProgress(format, {}, (p) => setProgress(p))
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div>
      <h2>Export Report</h2>
      
      <div>
        <button onClick={() => handleExport('pdf')}>Export as PDF</button>
        <button onClick={() => handleExport('excel')}>Export as Excel</button>
        <button onClick={() => handleExport('slides')}>Export as Slides</button>
        <button onClick={() => handleExport('word')}>Export as Word</button>
      </div>

      {activeExportJobs.length > 0 && (
        <div>
          <h3>Active Exports</h3>
          {activeExportJobs.map(job => (
            <div key={job.id}>
              <p>{job.export_format.toUpperCase()}: {job.status}</p>
              <progress value={progress} max={100} />
              <button onClick={() => actions.cancelExport(job.id)}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      {exportJobs.filter(j => j.status === 'completed').length > 0 && (
        <div>
          <h3>Completed Exports</h3>
          {exportJobs
            .filter(j => j.status === 'completed')
            .map(job => (
              <div key={job.id}>
                <a href={job.file_url} download>
                  Download {job.export_format.toUpperCase()}
                </a>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

/**
 * Example 5: Chat-Based Editing
 */
function ChatEditor() {
  const { actions, state } = usePMRContext()
  const [message, setMessage] = useState('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([])

  const handleSendMessage = async () => {
    if (!message.trim()) return

    setChatHistory(prev => [...prev, { role: 'user', content: message }])

    try {
      const response = await actions.sendChatEdit({
        message,
        context: {
          currentSection: 'executive_summary'
        }
      })

      setChatHistory(prev => [...prev, { role: 'assistant', content: response.response }])
      setMessage('')
    } catch (error) {
      console.error('Chat edit failed:', error)
    }
  }

  return (
    <div>
      <h2>AI Chat Editor</h2>
      
      <div style={{ height: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px' }}>
        {chatHistory.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '10px' }}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <div>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Ask AI to edit the report..."
          style={{ width: '80%' }}
        />
        <button onClick={handleSendMessage}>Send</button>
      </div>
    </div>
  )
}

/**
 * Example 6: Collaboration Status
 */
function CollaborationStatus() {
  const { isCollaborating, activeCollaborators, actions } = useEnhancedPMRContext()

  const handleStartCollaboration = async () => {
    await actions.startCollaboration(['user2@example.com', 'user3@example.com'])
  }

  const handleEndCollaboration = async () => {
    await actions.endCollaboration()
  }

  return (
    <div>
      <h2>Collaboration</h2>
      
      {!isCollaborating ? (
        <button onClick={handleStartCollaboration}>Start Collaboration</button>
      ) : (
        <div>
          <p>Active Collaborators: {activeCollaborators.length}</p>
          <ul>
            {activeCollaborators.map(userId => (
              <li key={userId}>{userId}</li>
            ))}
          </ul>
          <button onClick={handleEndCollaboration}>End Collaboration</button>
        </div>
      )}
    </div>
  )
}

/**
 * Example 7: Complete App with Provider
 */
export function PMRApp() {
  return (
    <PMRProvider apiBaseUrl="/api">
      <div>
        <ReportViewer reportId="report-123" />
        <SectionEditor sectionId="executive-summary" />
        <AIInsightsPanel />
        <ExportManager />
        <ChatEditor />
        <CollaborationStatus />
      </div>
    </PMRProvider>
  )
}

/**
 * Example 8: Error Recovery
 */
function ErrorRecoveryExample() {
  const { state, actions } = usePMRContext()

  return (
    <div>
      {state.error && (
        <div style={{ backgroundColor: '#fee', padding: '10px', marginBottom: '10px' }}>
          <p>Error: {state.error}</p>
          <button onClick={actions.clearError}>Dismiss</button>
          <button onClick={actions.retryLastOperation}>Retry</button>
        </div>
      )}
      
      {state.pendingChanges.size > 0 && (
        <div style={{ backgroundColor: '#ffa', padding: '10px', marginBottom: '10px' }}>
          <p>⚠️ You have {state.pendingChanges.size} unsaved changes</p>
          {!state.isOnline && <p>Changes will sync when you're back online</p>}
        </div>
      )}
    </div>
  )
}

export default PMRApp
