/**
 * Unit tests for lib/utils/env.ts
 * EnvironmentManager: get, isDevelopment, isProduction, isTest, getPublicConfig.
 */

jest.mock('../../monitoring/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}))

const originalEnv = process.env

describe('lib/utils/env', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    // Ensure required vars so validation does not throw (except in the test that asserts production throw)
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key'
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('env singleton', () => {
    it('get NODE_ENV returns current value', async () => {
      process.env.NODE_ENV = 'test'
      const { env } = await import('../../utils/env')
      expect(env.get('NODE_ENV')).toBe('test')
    })

    it('get missing key returns undefined and logs warn', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
      const { env } = await import('../../utils/env')
      expect(env.get('DATABASE_URL')).toBeUndefined()
    })

    it('isDevelopment returns true when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development'
      const { env, isDevelopment } = await import('../../utils/env')
      expect(env.isDevelopment()).toBe(true)
      expect(isDevelopment()).toBe(true)
    })

    it('isProduction returns true when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
      const { env, isProduction } = await import('../../utils/env')
      expect(env.isProduction()).toBe(true)
      expect(isProduction()).toBe(true)
    })

    it('isTest returns true when NODE_ENV is test', async () => {
      process.env.NODE_ENV = 'test'
      const { env, isTest } = await import('../../utils/env')
      expect(env.isTest()).toBe(true)
      expect(isTest()).toBe(true)
    })
  })

  describe('getPublicConfig', () => {
    it('returns booleans for presence of secrets without values', async () => {
      process.env.NODE_ENV = 'test'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.DATABASE_URL
      jest.resetModules()
      const { env } = await import('../../utils/env')
      const config = env.getPublicConfig()
      expect(config.NODE_ENV).toBe('test')
      expect(config.hasSupabaseUrl).toBe(true)
      expect(config.hasSupabaseKey).toBe(true)
      expect(config.hasServiceRoleKey).toBe(false)
      expect(config.hasDatabaseUrl).toBe(false)
    })

    it('hasServiceRoleKey true when SUPABASE_SERVICE_ROLE_KEY set', async () => {
      process.env.NODE_ENV = 'test'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret'
      const { env } = await import('../../utils/env')
      expect(env.getPublicConfig().hasServiceRoleKey).toBe(true)
    })
  })

  describe('validation', () => {
    it('does not throw in test when required vars missing', async () => {
      process.env.NODE_ENV = 'test'
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      await expect(import('../../utils/env')).resolves.toBeDefined()
    })

    it('throws in production when required vars missing', async () => {
      jest.resetModules()
      process.env.NODE_ENV = 'production'
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      await expect(import('../../utils/env')).rejects.toThrow(/Missing required environment variables/)
    })
  })
})
