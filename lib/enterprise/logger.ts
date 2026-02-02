/**
 * Phase 1 – Security & Scalability: Logging with Correlation ID
 * Enterprise Readiness: Winston-style correlation ID on every log entry
 */

import { getOrCreateCorrelationId } from './correlation-id'
import { logger as baseLogger } from '@/lib/monitoring/logger'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface EnterpriseLogEntry {
  level: LogLevel
  message: string
  data?: unknown
  timestamp: Date
  context?: string
  correlation_id?: string
}

/**
 * Enterprise logger: same API as base logger but adds correlation_id to data.
 * Use for API calls and error reporting so support can trace by correlation_id.
 */
export const enterpriseLogger = {
  _withCorrelation(data?: unknown): Record<string, unknown> {
    const cid = getOrCreateCorrelationId()
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return { ...(data as Record<string, unknown>), correlation_id: cid }
    }
    return { correlation_id: cid }
  },

  debug(message: string, data?: unknown, context?: string) {
    baseLogger.debug(message, this._withCorrelation(data), context)
  },

  info(message: string, data?: unknown, context?: string) {
    baseLogger.info(message, this._withCorrelation(data), context)
  },

  warn(message: string, data?: unknown, context?: string) {
    baseLogger.warn(message, this._withCorrelation(data), context)
  },

  error(message: string, data?: unknown, context?: string) {
    baseLogger.error(message, this._withCorrelation(data), context)
  },
}

export default enterpriseLogger
