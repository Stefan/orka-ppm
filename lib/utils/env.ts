/**
 * Environment variables utility with type safety and validation
 */

import { logger } from './logger'

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
    this.validateEnvironment()
  }

  private loadEnvironmentVariables() {
    this.config = {
      NODE_ENV: (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      DATABASE_URL: process.env.DATABASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    }
  }

  private validateEnvironment() {
    const requiredVars: (keyof EnvConfig)[] = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ]

    const missingVars = requiredVars.filter(key => !this.config[key])

    if (missingVars.length > 0) {
      const message = `Missing required environment variables: ${missingVars.join(', ')}`
      logger.error('Environment Validation Failed', { missingVars })
      
      if (this.config.NODE_ENV === 'production') {
        throw new Error(message)
      } else {
        logger.warn('Development mode: Using fallback values for missing environment variables')
      }
    }

    this.isValidated = true
    logger.debug('Environment validation completed', { 
      nodeEnv: this.config.NODE_ENV,
      hasSupabaseUrl: !!this.config.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!this.config.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    if (!this.isValidated) {
      this.validateEnvironment()
    }

    const value = this.config[key]
    
    if (value === undefined || value === '') {
      logger.warn(`Environment variable ${key} is not set`)
      return undefined as EnvConfig[K]
    }

    return value
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