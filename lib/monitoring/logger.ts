/**
 * Logger utility for application-wide logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  data?: any
  timestamp: Date
  context?: string
}

class Logger {
  private logLevel: LogLevel = 'info'
  private logs: LogEntry[] = []
  private maxLogs: number = 1000

  constructor() {
    // Set log level based on environment
    if (typeof window !== 'undefined') {
      this.logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
    }
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private log(level: LogLevel, message: string, data?: any, context?: string) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      level,
      message,
      ...(data !== undefined ? { data } : {}),
      timestamp: new Date(),
      ...(context ? { context } : {})
    }

    // Add to internal log storage
    this.logs.push(entry)
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Console output: only in development to avoid noise and leakage in production
    const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
    if (!isProd) {
      const contextStr = context ? `[${context}] ` : ''
      const logMessage = `${contextStr}${message}`
      switch (level) {
        case 'debug':
          console.debug(logMessage, data)
          break
        case 'info':
          console.info(logMessage, data)
          break
        case 'warn':
          console.warn(logMessage, data)
          break
        case 'error':
          console.error(logMessage, data)
          break
      }
    }
  }

  debug(message: string, data?: any, context?: string) {
    this.log('debug', message, data, context)
  }

  info(message: string, data?: any, context?: string) {
    this.log('info', message, data, context)
  }

  warn(message: string, data?: any, context?: string) {
    this.log('warn', message, data, context)
  }

  error(message: string, data?: any, context?: string) {
    this.log('error', message, data, context)
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.logs]
    return this.logs.filter(log => log.level === level)
  }

  clearLogs() {
    this.logs = []
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
}

// Export singleton instance
export const logger = new Logger()

// Export default
export default logger