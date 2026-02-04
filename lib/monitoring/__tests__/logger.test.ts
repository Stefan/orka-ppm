/**
 * @jest-environment jsdom
 */
import { logger } from '../logger'

describe('lib/monitoring/logger', () => {
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  }

  beforeEach(() => {
    logger.clearLogs()
    logger.setLogLevel('debug')
    jest.spyOn(console, 'debug').mockImplementation()
    jest.spyOn(console, 'info').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('setLogLevel and level filtering', () => {
    it('logs all levels when level is debug', () => {
      logger.setLogLevel('debug')
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')
      const logs = logger.getLogs()
      expect(logs).toHaveLength(4)
      expect(logs.map(l => l.level)).toEqual(['debug', 'info', 'warn', 'error'])
    })

    it('filters out debug when level is info', () => {
      logger.setLogLevel('info')
      logger.debug('d')
      logger.info('i')
      expect(logger.getLogs()).toHaveLength(1)
      expect(logger.getLogs()[0].message).toBe('i')
    })

    it('filters out debug and info when level is warn', () => {
      logger.setLogLevel('warn')
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      expect(logger.getLogs()).toHaveLength(1)
      expect(logger.getLogs()[0].message).toBe('w')
    })

    it('only logs error when level is error', () => {
      logger.setLogLevel('error')
      logger.debug('d')
      logger.info('i')
      logger.warn('w')
      logger.error('e')
      expect(logger.getLogs()).toHaveLength(1)
      expect(logger.getLogs()[0].level).toBe('error')
    })
  })

  describe('log methods', () => {
    it('stores message and level', () => {
      logger.info('hello')
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0].message).toBe('hello')
      expect(logs[0].level).toBe('info')
      expect(logs[0].timestamp).toBeInstanceOf(Date)
    })

    it('includes optional data', () => {
      logger.info('msg', { foo: 1 })
      expect(logger.getLogs()[0].data).toEqual({ foo: 1 })
    })

    it('omits data when not provided', () => {
      logger.info('msg')
      expect(logger.getLogs()[0]).not.toHaveProperty('data')
    })

    it('includes context in log entry and message', () => {
      logger.info('msg', undefined, 'MyContext')
      const log = logger.getLogs()[0]
      expect(log.context).toBe('MyContext')
    })
  })

  describe('getLogs', () => {
    it('returns all logs when no level filter', () => {
      logger.debug('d')
      logger.info('i')
      expect(logger.getLogs()).toHaveLength(2)
    })

    it('filters by level when provided', () => {
      logger.debug('d')
      logger.info('i')
      logger.error('e')
      expect(logger.getLogs('info')).toHaveLength(1)
      expect(logger.getLogs('info')[0].message).toBe('i')
    })

    it('returns a copy (not mutating internal array)', () => {
      logger.info('x')
      const first = logger.getLogs()
      const second = logger.getLogs()
      expect(first).not.toBe(second)
      expect(first).toEqual(second)
    })
  })

  describe('clearLogs', () => {
    it('empties internal log storage', () => {
      logger.info('x')
      logger.clearLogs()
      expect(logger.getLogs()).toHaveLength(0)
    })
  })

  describe('exportLogs', () => {
    it('returns JSON string of logs', () => {
      logger.info('a')
      const exported = logger.exportLogs()
      expect(() => JSON.parse(exported)).not.toThrow()
      const parsed = JSON.parse(exported)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].message).toBe('a')
    })
  })

  describe('maxLogs trimming', () => {
    it('keeps only last 1000 entries when exceeding maxLogs', () => {
      for (let i = 0; i < 1005; i++) {
        logger.info(`msg ${i}`)
      }
      const logs = logger.getLogs()
      expect(logs).toHaveLength(1000)
      expect(logs[0].message).toBe('msg 5')
      expect(logs[999].message).toBe('msg 1004')
    })
  })
})
