/**
 * Environment variables utility with type safety and validation
 */

import { logger } from '../monitoring/logger'

interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test'
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  DATABASE_URL?: string
  NEXTAUTH_SECRET?: string
  NEXTAUTH_URL?: string
}

class EnvironmentManager {
  private config: Partial<EnvConfig> = {}
  private isValidated = false

  constructor() {
    this.loadEnvironmentVariables()
    try {
      this.validateEnvironment()
    } catch (_) {
      // Never let constructor throw (e.g. during Next.js build or if logger throws)
      this.isValidated = true
    }
  }

  private loadEnvironmentVariables() {
    this.config = {
      NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      ...(process.env.SUPABASE_SERVICE_ROLE_KEY && { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY }),
      ...(process.env.DATABASE_URL && { DATABASE_URL: process.env.DATABASE_URL }),
      ...(process.env.NEXTAUTH_SECRET && { NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET }),
      ...(process.env.NEXTAUTH_URL && { NEXTAUTH_URL: process.env.NEXTAUTH_URL }),
    }
  }

  private static readonly REQUIRED_VARS: (keyof EnvConfig)[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ]

  private validateEnvironment() {
    const missingVars = EnvironmentManager.REQUIRED_VARS.filter(key => !this.config[key])
    const isNextBuild =
      typeof process !== 'undefined' &&
      process.env.NEXT_PHASE === 'phase-production-build'

    if (missingVars.length > 0) {
      try {
        logger.error('Environment Validation Failed', { missingVars })
        if (this.config.NODE_ENV !== 'production') {
          logger.warn('Development mode: Using fallback values for missing environment variables')
        }
      } catch (_) {
        // Ignore logger errors (e.g. during Next.js build)
      }
      // Never throw in constructor: during Next.js build vars are often unset; we throw
      // lazily in get() when a required var is actually read in production runtime.
    }

    this.isValidated = true
    if (!isNextBuild) {
      try {
        logger.debug('Environment validation completed', {
          nodeEnv: this.config.NODE_ENV,
          hasSupabaseUrl: !!this.config.NEXT_PUBLIC_SUPABASE_URL,
          hasSupabaseKey: !!this.config.NEXT_PUBLIC_SUPABASE_ANON_KEY
        })
      } catch (_) {
        // Ignore logger errors
      }
    }
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    if (!this.isValidated) {
      this.validateEnvironment()
    }

    const value = this.config[key]

    if (value === undefined || value === '') {
      if (
        this.config.NODE_ENV === 'production' &&
        EnvironmentManager.REQUIRED_VARS.includes(key)
      ) {
        throw new Error(
          `Missing required environment variable: ${String(key)}`
        )
      }
      logger.warn(`Environment variable ${key} is not set`)
      return undefined as EnvConfig[K]
    }

    return value as EnvConfig[K]
  }

  isDevelopment(): boolean {
    return this.get('NODE_ENV') === 'development'
  }

  isProduction(): boolean {
    return this.get('NODE_ENV') === 'production'
  }

  isTest(): boolean {
    return this.get('NODE_ENV') === 'test'
  }

  // Get all non-sensitive config for debugging
  getPublicConfig() {
    return {
      NODE_ENV: this.config.NODE_ENV,
      hasSupabaseUrl: !!this.config.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!this.config.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceRoleKey: !!this.config.SUPABASE_SERVICE_ROLE_KEY,
      hasDatabaseUrl: !!this.config.DATABASE_URL,
      hasNextAuthSecret: !!this.config.NEXTAUTH_SECRET,
      hasNextAuthUrl: !!this.config.NEXTAUTH_URL,
    }
  }
}

// Export singleton instance
export const env = new EnvironmentManager()

// Convenience exports
export const isDevelopment = () => env.isDevelopment()
export const isProduction = () => env.isProduction()
export const isTest = () => env.isTest()

export default env