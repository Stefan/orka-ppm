/**
 * Client-side error reporting system
 * Implements Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.4
 */

import { diagnosticCollector, type ErrorLog, type DiagnosticData } from './diagnostic-collector'
import { logger } from '../monitoring/logger'

export interface ErrorReportConfig {
  apiEndpoint?: string
  enableConsoleReporting: boolean
  enableLocalStorage: boolean
  enableRemoteReporting: boolean
  batchSize: number
  flushInterval: number
  maxRetries: number
  enableUserFeedback: boolean
}

export interface ErrorReport {
  id: string
  timestamp: Date
  errors: ErrorLog[]
  diagnosticData: DiagnosticData
  userFeedback?: string
  reproductionSteps?: string[]
  userAgent: string
  url: string
  sessionId: string
}

export interface UserFeedbackData {
  errorId: string
  feedback: string
  reproductionSteps: string[]
  userEmail?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

class ErrorReportingService {
  private static instance: ErrorReportingService
  private config: ErrorReportConfig
  private pendingReports: ErrorReport[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private retryQueue: ErrorReport[] = []

  private constructor(config: Partial<ErrorReportConfig> = {}) {
    this.config = {
      enableConsoleReporting: true,
      enableLocalStorage: true,
      enableRemoteReporting: false, // Disabled by default until endpoint is configured
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      maxRetries: 3,
      enableUserFeedback: true,
      ...config
    }

    this.startFlushTimer()
    this.setupBeforeUnloadHandler()
  }

  static getInstance(config?: Partial<ErrorReportConfig>): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService(config)
    }
    return ErrorReportingService.instance
  }

  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      this.flushReports()
    }, this.config.flushInterval)
  }

  private setupBeforeUnloadHandler() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushReports(true) // Synchronous flush on page unload
      })
    }
  }

  updateConfig(newConfig: Partial<ErrorReportConfig>) {
    this.config = { ...this.config, ...newConfig }
    this.startFlushTimer() // Restart timer with new interval if changed
  }

  reportError(errorId: string, userFeedback?: UserFeedbackData) {
    const errorLog = diagnosticCollector.getErrorLogs().find(log => log.id === errorId)
    if (!errorLog) {
      logger.warn(`Error log not found for ID: ${errorId}`)
      return
    }

    const report: ErrorReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      errors: [errorLog],
      diagnosticData: diagnosticCollector.getDiagnosticData(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: errorLog.sessionId
    }

    if (userFeedback?.feedback) {
      report.userFeedback = userFeedback.feedback
    }

    if (userFeedback?.reproductionSteps) {
      report.reproductionSteps = userFeedback.reproductionSteps
    }

    this.addReport(report)
    return report.id
  }

  reportMultipleErrors(errorIds: string[], userFeedback?: UserFeedbackData) {
    const errorLogs = diagnosticCollector.getErrorLogs().filter(log => 
      errorIds.includes(log.id)
    )

    if (errorLogs.length === 0) {
      logger.warn(`No error logs found for IDs: ${errorIds.join(', ')}`)
      return
    }

    const report: ErrorReport = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      errors: errorLogs,
      diagnosticData: diagnosticCollector.getDiagnosticData(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: errorLogs[0]?.sessionId || 'unknown'
    }

    if (userFeedback?.feedback) {
      report.userFeedback = userFeedback.feedback
    }

    if (userFeedback?.reproductionSteps) {
      report.reproductionSteps = userFeedback.reproductionSteps
    }

    this.addReport(report)
    return report.id
  }

  reportCriticalError(error: Error, component: string, context?: Record<string, any>) {
    // Log the error first
    const errorId = diagnosticCollector.logError({
      error,
      component,
      errorType: 'component',
      severity: 'critical',
      ...(context && { context })
    })

    // Immediately create and send report for critical errors
    const report: ErrorReport = {
      id: `critical_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      errors: [diagnosticCollector.getErrorLogs().find(log => log.id === errorId)!],
      diagnosticData: diagnosticCollector.getDiagnosticData(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: diagnosticCollector.getDiagnosticData().sessionInfo.sessionId
    }

    // Send immediately for critical errors
    this.sendReport(report)
    return report.id
  }

  private addReport(report: ErrorReport) {
    this.pendingReports.push(report)

    // Console reporting
    if (this.config.enableConsoleReporting) {
      this.logReportToConsole(report)
    }

    // Local storage
    if (this.config.enableLocalStorage) {
      this.saveReportToLocalStorage(report)
    }

    // Check if we should flush immediately
    if (this.pendingReports.length >= this.config.batchSize) {
      this.flushReports()
    }
  }

  private logReportToConsole(report: ErrorReport) {
    console.group(`🚨 Error Report: ${report.id}`)
    console.log('Timestamp:', report.timestamp.toISOString())
    console.log('Errors:', report.errors.length)
    console.log('Session ID:', report.sessionId)
    
    report.errors.forEach((error, index) => {
      console.group(`Error ${index + 1}: ${error.component}`)
      console.error('Message:', error.error.message)
      console.error('Type:', error.errorType)
      console.error('Severity:', error.severity)
      console.error('Stack:', error.stackTrace)
      console.log('Context:', error.context)
      console.groupEnd()
    })

    if (report.userFeedback) {
      console.log('User Feedback:', report.userFeedback)
    }

    if (report.reproductionSteps) {
      console.log('Reproduction Steps:', report.reproductionSteps)
    }

    console.log('System Info:', report.diagnosticData.systemInfo)
    console.groupEnd()
  }

  private saveReportToLocalStorage(report: ErrorReport) {
    try {
      const key = `error_report_${report.id}`
      const data = {
        ...report,
        // Serialize dates
        timestamp: report.timestamp.toISOString(),
        errors: report.errors.map(error => ({
          ...error,
          timestamp: error.timestamp.toISOString()
        }))
      }
      
      localStorage.setItem(key, JSON.stringify(data))

      // Clean up old reports (keep last 50)
      const allKeys = Object.keys(localStorage).filter(key => key.startsWith('error_report_'))
      if (allKeys.length > 50) {
        const sortedKeys = allKeys.sort()
        const keysToRemove = sortedKeys.slice(0, allKeys.length - 50)
        keysToRemove.forEach(key => localStorage.removeItem(key))
      }
    } catch (error) {
      logger.warn('Failed to save error report to localStorage:', error)
    }
  }

  private async flushReports(synchronous: boolean = false) {
    if (this.pendingReports.length === 0) return

    const reportsToSend = [...this.pendingReports]
    this.pendingReports = []

    if (this.config.enableRemoteReporting && this.config.apiEndpoint) {
      for (const report of reportsToSend) {
        if (synchronous) {
          // Use sendBeacon for synchronous sending during page unload
          this.sendReportWithBeacon(report)
        } else {
          await this.sendReport(report)
        }
      }
    }
  }

  private async sendReport(report: ErrorReport, retryCount: number = 0): Promise<boolean> {
    if (!this.config.apiEndpoint) {
      logger.warn('No API endpoint configured for error reporting')
      return false
    }

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      logger.info(`Error report sent successfully: ${report.id}`)
      return true
    } catch (error) {
      logger.error(`Failed to send error report ${report.id}:`, error)

      // Retry logic
      if (retryCount < this.config.maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff
        setTimeout(() => {
          this.sendReport(report, retryCount + 1)
        }, delay)
      } else {
        // Add to retry queue for later
        this.retryQueue.push(report)
        logger.warn(`Error report ${report.id} added to retry queue after ${this.config.maxRetries} failed attempts`)
      }

      return false
    }
  }

  private sendReportWithBeacon(report: ErrorReport) {
    if (!this.config.apiEndpoint || !navigator.sendBeacon) {
      return false
    }

    try {
      const data = JSON.stringify(report)
      const sent = navigator.sendBeacon(this.config.apiEndpoint, data)
      
      if (sent) {
        logger.info(`Error report sent via beacon: ${report.id}`)
      } else {
        logger.warn(`Failed to send error report via beacon: ${report.id}`)
      }

      return sent
    } catch (error) {
      logger.error(`Error sending report via beacon:`, error)
      return false
    }
  }

  // Public API for user feedback
  collectUserFeedback(errorId: string): Promise<UserFeedbackData | null> {
    return new Promise((resolve) => {
      if (!this.config.enableUserFeedback) {
        resolve(null)
        return
      }

      // Create a simple feedback modal (in a real app, this would be a proper React component)
      const modal = this.createFeedbackModal(errorId, (feedback) => {
        resolve(feedback)
        document.body.removeChild(modal)
      })

      document.body.appendChild(modal)
    })
  }

  private createFeedbackModal(errorId: string, onSubmit: (feedback: UserFeedbackData | null) => void): HTMLElement {
    const modal = document.createElement('div')
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
    `

    modal.innerHTML = `
      <div style="
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <h3 style="margin: 0 0 16px 0; color: #dc2626;">Something went wrong</h3>
        <p style="margin: 0 0 16px 0; color: #6b7280;">
          We encountered an error and would appreciate your feedback to help us fix it.
        </p>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">
            What were you trying to do?
          </label>
          <textarea 
            id="feedback-text" 
            style="
              width: 100%;
              height: 80px;
              padding: 8px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              resize: vertical;
            "
            placeholder="Describe what you were doing when the error occurred..."
          ></textarea>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">
            Steps to reproduce (optional)
          </label>
          <textarea 
            id="reproduction-steps" 
            style="
              width: 100%;
              height: 60px;
              padding: 8px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              resize: vertical;
            "
            placeholder="1. Click on...&#10;2. Then...&#10;3. Error occurred"
          ></textarea>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 4px; font-weight: 500;">
            How severe is this issue?
          </label>
          <select id="severity" style="
            width: 100%;
            padding: 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
          ">
            <option value="low">Low - Minor inconvenience</option>
            <option value="medium" selected>Medium - Affects functionality</option>
            <option value="high">High - Blocks important tasks</option>
            <option value="critical">Critical - Prevents using the app</option>
          </select>
        </div>

        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button 
            id="cancel-btn"
            style="
              padding: 8px 16px;
              border: 1px solid #d1d5db;
              background: white;
              border-radius: 4px;
              cursor: pointer;
            "
          >
            Skip
          </button>
          <button 
            id="submit-btn"
            style="
              padding: 8px 16px;
              border: none;
              background: #2563eb;
              color: white;
              border-radius: 4px;
              cursor: pointer;
            "
          >
            Send Feedback
          </button>
        </div>
      </div>
    `

    // Event handlers
    const cancelBtn = modal.querySelector('#cancel-btn') as HTMLButtonElement
    const submitBtn = modal.querySelector('#submit-btn') as HTMLButtonElement
    const feedbackText = modal.querySelector('#feedback-text') as HTMLTextAreaElement
    const reproductionSteps = modal.querySelector('#reproduction-steps') as HTMLTextAreaElement
    const severity = modal.querySelector('#severity') as HTMLSelectElement

    cancelBtn.onclick = () => onSubmit(null)
    
    submitBtn.onclick = () => {
      const feedback: UserFeedbackData = {
        errorId,
        feedback: feedbackText.value.trim(),
        reproductionSteps: reproductionSteps.value.trim().split('\n').filter(step => step.trim()),
        severity: severity.value as UserFeedbackData['severity']
      }
      onSubmit(feedback)
    }

    // Close on escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSubmit(null)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return modal
  }

  // Utility methods
  getStoredReports(): ErrorReport[] {
    const reports: ErrorReport[] = []
    
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('error_report_'))
      
      for (const key of keys) {
        const data = localStorage.getItem(key)
        if (data) {
          const report = JSON.parse(data)
          // Deserialize dates
          report.timestamp = new Date(report.timestamp)
          report.errors = report.errors.map((error: any) => ({
            ...error,
            timestamp: new Date(error.timestamp)
          }))
          reports.push(report)
        }
      }
    } catch (error) {
      logger.warn('Failed to retrieve stored error reports:', error)
    }

    return reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  clearStoredReports() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('error_report_'))
      keys.forEach(key => localStorage.removeItem(key))
      logger.info(`Cleared ${keys.length} stored error reports`)
    } catch (error) {
      logger.warn('Failed to clear stored error reports:', error)
    }
  }

  getRetryQueue(): ErrorReport[] {
    return [...this.retryQueue]
  }

  retryFailedReports() {
    const reportsToRetry = [...this.retryQueue]
    this.retryQueue = []

    reportsToRetry.forEach(report => {
      this.sendReport(report)
    })

    logger.info(`Retrying ${reportsToRetry.length} failed error reports`)
  }

  // Cleanup
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    
    // Flush any pending reports
    this.flushReports(true)
  }
}

// Export singleton instance
export const errorReportingService = ErrorReportingService.getInstance()

// Utility functions
export const reportError = (errorId: string, userFeedback?: UserFeedbackData) =>
  errorReportingService.reportError(errorId, userFeedback)

export const reportCriticalError = (error: Error, component: string, context?: Record<string, any>) =>
  errorReportingService.reportCriticalError(error, component, context)

export const collectUserFeedback = (errorId: string) =>
  errorReportingService.collectUserFeedback(errorId)

export const configureErrorReporting = (config: Partial<ErrorReportConfig>) =>
  errorReportingService.updateConfig(config)

export default errorReportingService