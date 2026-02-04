/**
 * @jest-environment jsdom
 */
jest.mock('../../monitoring/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), info: jest.fn() }
}))
jest.mock('../../monitoring/performance-utils', () => ({
  performanceMonitor: {
    getMemoryUsage: jest.fn().mockReturnValue(null),
    getMetrics: jest.fn().mockReturnValue([])
  }
}))

import {
  diagnosticCollector,
  logError,
  logAuthenticationError,
  logApiError,
  logComponentError,
  logPerformanceMetric,
  logUserAction,
  addBreadcrumb
} from '../diagnostic-collector'

describe('lib/diagnostics/diagnostic-collector', () => {
  beforeEach(() => {
    diagnosticCollector.clearDiagnosticData()
  })

  describe('logError', () => {
    it('records error and returns id', () => {
      const id = logError({
        error: new Error('test'),
        component: 'TestComp',
        errorType: 'javascript',
        severity: 'high'
      })
      expect(id).toMatch(/^error_/)
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.errorLogs).toHaveLength(1)
      expect(data.errorLogs[0].component).toBe('TestComp')
      expect(data.errorLogs[0].error.message).toBe('test')
    })

    it('includes userId and context when provided', () => {
      logError({
        error: new Error('x'),
        component: 'C',
        errorType: 'api',
        severity: 'medium',
        userId: 'u1',
        context: { endpoint: '/api' }
      })
      const logs = diagnosticCollector.getErrorLogs()
      expect(logs[0].userId).toBe('u1')
      expect(logs[0].context).toMatchObject({ endpoint: '/api' })
    })
  })

  describe('logAuthenticationError', () => {
    it('logs with authentication type and high severity', () => {
      logAuthenticationError(new Error('auth failed'), { provider: 'google' })
      const logs = diagnosticCollector.getErrorLogs({ errorType: 'authentication' })
      expect(logs).toHaveLength(1)
      expect(logs[0].severity).toBe('high')
      expect(logs[0].context?.authState).toBe('failed')
    })
  })

  describe('logApiError', () => {
    it('records api metric and error log', () => {
      const id = logApiError({
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 500,
        error: new Error('Server error'),
        responseTime: 100,
        retryCount: 1
      })
      expect(id).toMatch(/^error_/)
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.apiMetrics).toHaveLength(1)
      expect(data.apiMetrics[0].endpoint).toBe('/api/users')
      expect(data.apiMetrics[0].statusCode).toBe(500)
      expect(data.errorLogs).toHaveLength(1)
    })

    it('uses high severity for statusCode >= 500, medium otherwise', () => {
      logApiError({
        endpoint: '/api/x',
        method: 'GET',
        statusCode: 404,
        error: new Error('Not found'),
        responseTime: 50
      })
      const highLogs = diagnosticCollector.getErrorLogs({ severity: 'high' })
      const mediumLogs = diagnosticCollector.getErrorLogs({ severity: 'medium' })
      expect(mediumLogs.some(l => l.context?.statusCode === 404)).toBe(true)
      diagnosticCollector.clearDiagnosticData()
      logApiError({
        endpoint: '/api/y',
        method: 'GET',
        statusCode: 503,
        error: new Error('Unavailable'),
        responseTime: 100
      })
      expect(diagnosticCollector.getErrorLogs({ severity: 'high' }).length).toBeGreaterThan(0)
    })
  })

  describe('logComponentError', () => {
    it('logs with component type', () => {
      logComponentError(new Error('render failed'), 'MyComponent', { props: {} })
      const logs = diagnosticCollector.getErrorLogs({ errorType: 'component' })
      expect(logs).toHaveLength(1)
      expect(logs[0].component).toBe('MyComponent')
    })
  })

  describe('logPerformanceMetric', () => {
    it('records metric and returns id', () => {
      const id = logPerformanceMetric({
        name: 'lcp',
        value: 2000,
        unit: 'ms',
        component: 'page'
      })
      expect(id).toMatch(/^perf_/)
      const metrics = diagnosticCollector.getPerformanceMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('lcp')
      expect(metrics[0].value).toBe(2000)
    })
  })

  describe('logUserAction', () => {
    it('records action and returns id', () => {
      const id = logUserAction({ action: 'click', component: 'Button', data: { id: 'submit' } })
      expect(id).toMatch(/^action_/)
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.userActions).toHaveLength(1)
      expect(data.userActions[0].action).toBe('click')
    })

    it('records action without data or userId', () => {
      const id = logUserAction({ action: 'scroll', component: 'Page' })
      expect(id).toMatch(/^action_/)
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.userActions[0].data).toBeUndefined()
      expect(data.userActions[0].userId).toBeUndefined()
    })

    it('includes userId when provided', () => {
      logUserAction({ action: 'submit', component: 'Form', userId: 'user-123' })
      expect(diagnosticCollector.getDiagnosticData().userActions[0].userId).toBe('user-123')
    })
  })

  describe('addBreadcrumb', () => {
    it('adds breadcrumb to subsequent error logs', () => {
      addBreadcrumb({ category: 'user-action', message: 'clicked save' })
      logError({
        error: new Error('e'),
        component: 'X',
        errorType: 'javascript',
        severity: 'low'
      })
      const logs = diagnosticCollector.getErrorLogs()
      expect(logs[0].breadcrumbs).toHaveLength(1)
      expect(logs[0].breadcrumbs[0].message).toBe('clicked save')
    })

    it('adds breadcrumb with data when provided', () => {
      addBreadcrumb({ category: 'api-call', message: 'GET /api', data: { status: 200 } })
      logError({ error: new Error('e'), component: 'X', errorType: 'javascript', severity: 'low' })
      expect(diagnosticCollector.getErrorLogs()[0].breadcrumbs[0].data).toEqual({ status: 200 })
    })
  })

  describe('getErrorLogs filter', () => {
    it('filters by component', () => {
      logError({ error: new Error('a'), component: 'A', errorType: 'javascript', severity: 'low' })
      logError({ error: new Error('b'), component: 'B', errorType: 'javascript', severity: 'low' })
      expect(diagnosticCollector.getErrorLogs({ component: 'A' })).toHaveLength(1)
    })

    it('filters by errorType', () => {
      logError({ error: new Error('j'), component: 'X', errorType: 'javascript', severity: 'low' })
      logError({ error: new Error('n'), component: 'X', errorType: 'network', severity: 'medium' })
      expect(diagnosticCollector.getErrorLogs({ errorType: 'network' })).toHaveLength(1)
      expect(diagnosticCollector.getErrorLogs({ errorType: 'network' })[0].errorType).toBe('network')
    })

    it('returns all logs when no filter', () => {
      logError({ error: new Error('e'), component: 'X', errorType: 'javascript', severity: 'low' })
      expect(diagnosticCollector.getErrorLogs()).toHaveLength(1)
      expect(diagnosticCollector.getErrorLogs(undefined)).toHaveLength(1)
    })

    it('filters by severity', () => {
      logError({ error: new Error('h'), component: 'X', errorType: 'javascript', severity: 'high' })
      logError({ error: new Error('l'), component: 'X', errorType: 'javascript', severity: 'low' })
      expect(diagnosticCollector.getErrorLogs({ severity: 'high' })).toHaveLength(1)
    })

    it('filters by since date', () => {
      logError({ error: new Error('e'), component: 'X', errorType: 'javascript', severity: 'low' })
      const since = new Date(Date.now() + 10000)
      expect(diagnosticCollector.getErrorLogs({ since })).toHaveLength(0)
    })
  })

  describe('getPerformanceMetrics filter', () => {
    it('filters by name', () => {
      logPerformanceMetric({ name: 'lcp', value: 1, unit: 'ms' })
      logPerformanceMetric({ name: 'fid', value: 2, unit: 'ms' })
      expect(diagnosticCollector.getPerformanceMetrics({ name: 'lcp' })).toHaveLength(1)
    })

    it('filters by component and since', () => {
      logPerformanceMetric({ name: 'x', value: 1, unit: 'ms', component: 'page' })
      logPerformanceMetric({ name: 'x', value: 2, unit: 'ms', component: 'widget' })
      expect(diagnosticCollector.getPerformanceMetrics({ component: 'page' })).toHaveLength(1)
      const since = new Date(Date.now() + 10000)
      expect(diagnosticCollector.getPerformanceMetrics({ since })).toHaveLength(0)
    })
  })

  describe('getDiagnosticData', () => {
    it('includes systemInfo and sessionInfo', () => {
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.systemInfo).toBeDefined()
      expect(data.systemInfo.userAgent).toBeDefined()
      expect(data.sessionInfo).toBeDefined()
      expect(data.sessionInfo.sessionId).toMatch(/^session_/)
    })
  })

  describe('exportDiagnosticReport', () => {
    it('returns JSON string', () => {
      logError({ error: new Error('e'), component: 'X', errorType: 'javascript', severity: 'low' })
      const report = diagnosticCollector.exportDiagnosticReport()
      expect(() => JSON.parse(report)).not.toThrow()
      expect(JSON.parse(report).errorLogs).toHaveLength(1)
    })
  })

  describe('logPerformanceMetric', () => {
    it('records metric and returns id', () => {
      const id = logPerformanceMetric({
        name: 'lcp',
        value: 2000,
        unit: 'ms',
        component: 'page'
      })
      expect(id).toMatch(/^perf_/)
      const metrics = diagnosticCollector.getPerformanceMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0].name).toBe('lcp')
      expect(metrics[0].value).toBe(2000)
    })

    it('records metric with context', () => {
      logPerformanceMetric({ name: 'custom', value: 42, unit: 'ms', context: { extra: true } })
      const metrics = diagnosticCollector.getPerformanceMetrics({ name: 'custom' })
      expect(metrics[0].context).toEqual({ extra: true })
    })

    it('records metric without component', () => {
      logPerformanceMetric({ name: 'fcp', value: 100, unit: 'ms' })
      const metrics = diagnosticCollector.getPerformanceMetrics()
      expect(metrics[metrics.length - 1].component).toBeUndefined()
    })
  })

  describe('logPerformanceMetric isPerformanceIssue', () => {
    it('calls logger.warn when value exceeds threshold', () => {
      const logger = require('../../monitoring/logger').logger
      logPerformanceMetric({ name: 'lcp', value: 3000, unit: 'ms' })
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Performance issue'), expect.any(Object))
    })

    it('does not call logger.warn when value below threshold', () => {
      const logger = require('../../monitoring/logger').logger
      ;(logger.warn as jest.Mock).mockClear()
      logPerformanceMetric({ name: 'lcp', value: 1000, unit: 'ms' })
      expect(logger.warn).not.toHaveBeenCalled()
    })
  })

  describe('clearDiagnosticData', () => {
    it('clears all stored data', () => {
      logError({ error: new Error('e'), component: 'X', errorType: 'javascript', severity: 'low' })
      diagnosticCollector.clearDiagnosticData()
      expect(diagnosticCollector.getDiagnosticData().errorLogs).toHaveLength(0)
    })
  })

  describe('updateSessionInfo', () => {
    it('updates session and adds breadcrumbs', () => {
      diagnosticCollector.updateSessionInfo({ userId: 'u1', isAuthenticated: true })
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.sessionInfo).toBeDefined()
    })

    it('adds breadcrumb when only userId updated', () => {
      diagnosticCollector.clearDiagnosticData()
      diagnosticCollector.updateSessionInfo({ userId: 'u2' })
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.sessionInfo).toBeDefined()
    })

    it('adds breadcrumb when only isAuthenticated updated', () => {
      diagnosticCollector.updateSessionInfo({ isAuthenticated: false })
      const data = diagnosticCollector.getDiagnosticData()
      expect(data.sessionInfo.isAuthenticated).toBe(false)
    })
  })

  describe('trimArray (maxStoredItems)', () => {
    it('keeps only last 1000 error logs', () => {
      for (let i = 0; i < 1005; i++) {
        logError({
          error: new Error(`e${i}`),
          component: 'X',
          errorType: 'javascript',
          severity: 'low'
        })
      }
      expect(diagnosticCollector.getErrorLogs().length).toBeLessThanOrEqual(1000)
    })
  })

  describe('logApiError', () => {
    it('defaults retryCount to 0', () => {
      logApiError({
        endpoint: '/api/z',
        method: 'GET',
        statusCode: 500,
        error: new Error('err'),
        responseTime: 10
      })
      expect(diagnosticCollector.getDiagnosticData().apiMetrics[0].retryCount).toBe(0)
    })
  })
})
