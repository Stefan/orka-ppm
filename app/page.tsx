'use client'

import React, { useState } from 'react'
import { useAuth } from './providers/SupabaseAuthProvider'
import Sidebar from '../components/navigation/Sidebar'
import { supabase, ENV_CONFIG } from '../lib/api/supabase-minimal'
import { useAutoPrefetch } from '../hooks/useRoutePrefetch'
import { GlobalLanguageSelector } from '../components/navigation/GlobalLanguageSelector'
import { useTranslations } from '@/lib/i18n/context'
import { Eye, EyeOff } from 'lucide-react'

export default function Home() {
  const { session, loading } = useAuth()
  const { t } = useTranslations()

  // Prefetch /dashboards route for instant navigation
  useAutoPrefetch(['/dashboards'], 1000)

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('auth.loading')}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  // Redirect to dashboards if logged in
  if (typeof window !== 'undefined') {
    window.location.href = '/dashboards'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{t('auth.redirecting')}</p>
      </div>
    </div>
  )
}

function LoginForm() {
  const { t } = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Log environment configuration on component mount
  React.useEffect(() => {
    console.log('🔍 LoginForm Environment Check (Production v2):')
    console.log('- ENV_CONFIG:', ENV_CONFIG)
    console.log('- Supabase client available:', !!supabase)
    console.log('- Auth methods available:', !!supabase?.auth)
    console.log('- Validation source:', 'environment')
    console.log('- Force override active:', ENV_CONFIG.isDevelopment)
    console.log('- Production mode:', ENV_CONFIG.isProduction)
    console.log('- Environment bypass:', ENV_CONFIG.isDevelopment)
    console.log('- API URL:', ENV_CONFIG.supabaseUrl)
    
    // Additional environment diagnostics
    console.log('🔧 Environment Diagnostics (Production v2):')
    console.log('- Using minimal config:', true)
    console.log('- Hardcoded URL length:', ENV_CONFIG.supabaseUrl.length)
    console.log('- Hardcoded key length:', ENV_CONFIG.supabaseAnonKey.length)
    console.log('- Key preview:', ENV_CONFIG.supabaseAnonKey.substring(0, 10) + '...')
    console.log('- Supabase client config:', {
      url: ENV_CONFIG.supabaseUrl,
      keyLength: ENV_CONFIG.supabaseAnonKey.length,
      isValid: !!(ENV_CONFIG.supabaseUrl && ENV_CONFIG.supabaseAnonKey)
    })
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // ENHANCED: Trim and validate inputs - CRITICAL FIX for copy-paste issues
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    // Enhanced input validation
    if (!trimmedEmail || !trimmedPassword) {
      setError(t('auth.errors.bothRequired'))
      setLoading(false)
      return
    }

    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      setError(t('auth.errors.invalidEmail'))
      setLoading(false)
      return
    }

    if (trimmedPassword.length < 6) {
      setError(t('auth.errors.passwordTooShort'))
      setLoading(false)
      return
    }

    console.log('🚀 Starting authentication...')
    console.log('- Email:', trimmedEmail)
    console.log('- Is Signup:', isSignup)
    console.log('- ENV Config Valid:', !!(ENV_CONFIG.supabaseUrl && ENV_CONFIG.supabaseAnonKey))
    console.log('- Development Mode:', ENV_CONFIG.isDevelopment)
    console.log('- Key Length:', ENV_CONFIG.supabaseAnonKey.length)

    // Check if Supabase is properly configured
    if (!ENV_CONFIG.supabaseUrl || !ENV_CONFIG.supabaseAnonKey || 
        ENV_CONFIG.supabaseUrl === 'https://placeholder.supabase.co' ||
        ENV_CONFIG.supabaseAnonKey === 'placeholder-anon-key') {
      setError('❌ CONFIGURATION ERROR: Supabase environment variables are not configured. Authentication is disabled in development mode.')
      console.warn('💡 SOLUTION: Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local file')
      setLoading(false)
      return
    }

    try {
      console.log('🔐 Calling Supabase auth...')
      
      const { data, error: authError } = isSignup
        ? await supabase.auth.signUp({ 
            email: trimmedEmail, 
            password: trimmedPassword,
            options: {
              emailRedirectTo: window.location.origin
            }
          })
        : await supabase.auth.signInWithPassword({ 
            email: trimmedEmail, 
            password: trimmedPassword 
          })
      
      if (authError) {
        console.error('❌ Supabase Auth Error:', authError)
        console.error('- Error message:', authError.message)
        console.error('- Error status:', authError.status)
        
        // ENHANCED: Specific error handling for different failure modes
        if (authError.message.includes('Invalid login credentials')) {
          setError(t('auth.errors.invalidCredentials'))
        } else if (authError.message.includes('Email not confirmed')) {
          setError(t('auth.errors.emailNotConfirmed'))
        } else if (authError.message.includes('User already registered')) {
          setError(t('auth.errors.userAlreadyRegistered'))
        } else if (authError.message.includes('Invalid API key') || authError.message.includes('JWT')) {
          setError(t('auth.errors.configError'))
          console.error('💡 SOLUTION: Check Vercel environment variables - ANON_KEY may be corrupted')
          console.error('💡 Expected key length: ~208 chars, Current:', ENV_CONFIG.supabaseAnonKey.length)
        } else if (authError.message.includes('NetworkError') || authError.message.includes('fetch') || authError.message.includes('CORS')) {
          setError(t('auth.errors.networkError'))
          console.error('💡 SOLUTION: Check backend CORS configuration and network connectivity')
        } else {
          setError(`Authentication failed: ${authError.message}`)
        }
        setLoading(false)
        return
      }

      // Success handling
      console.log('✅ Authentication successful:', data)
      
      if (isSignup) {
        if (data.user && !data.user.email_confirmed_at) {
          setError(t('auth.success.accountCreated'))
        } else {
          setError(t('auth.success.accountConfirmed'))
        }
      } else {
        setError(t('auth.success.loginSuccess'))
        // Redirect after short delay
        setTimeout(() => {
          window.location.href = '/dashboards'
        }, 1500)
      }
      
    } catch (err: unknown) {
      console.error('🚨 Authentication Exception:', err)
      
      if (err instanceof Error) {
        console.error('- Exception message:', err.message)
        console.error('- Exception stack:', err.stack)
        
        // ENHANCED: Specific fetch error handling for copy-paste corruption
        if (err.message.includes('Failed to execute \'fetch\'') || err.message.includes('Invalid value')) {
          setError('❌ CRITICAL ERROR: Invalid fetch configuration. Environment variables are corrupted.')
          console.error('💡 SOLUTION: Check browser console for validation errors')
          console.error('💡 Raw key length should be ~208, current ENV length:', ENV_CONFIG.supabaseAnonKey.length)
          console.error('💡 Fix: Delete and re-add NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel dashboard')
        } else if (err.message.includes('COPY-PASTE ERROR') || err.message.includes('variable names')) {
          setError('❌ COPY-PASTE ERROR: Environment variable contains variable names instead of values.')
          console.error('💡 SOLUTION: In Vercel dashboard, paste ONLY the JWT token value, not the variable name')
        } else if (err.message.includes('assignment syntax')) {
          setError('❌ ASSIGNMENT ERROR: Environment variable contains "=" assignment syntax.')
          console.error('💡 SOLUTION: Copy only the JWT value, not "NEXT_PUBLIC_SUPABASE_ANON_KEY=..."')
        } else if (err.message.includes('NetworkError') || err.message.includes('CORS')) {
          setError('❌ NETWORK ERROR: Cannot reach authentication service. Check CORS configuration.')
        } else {
          setError(t('auth.errors.unexpectedError'))
        }
      } else {
        setError(t('auth.errors.unexpectedError'))
      }
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Language Selector - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <GlobalLanguageSelector variant="topbar" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isSignup ? t('auth.signUp') : t('auth.signIn')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.subtitle')}
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 required">
                {t('auth.email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 input-field w-full"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 required">
                {t('auth.password')}
              </label>
              <div className="relative mt-2">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full"
                  style={{ paddingRight: '3rem' }}
                  placeholder={isSignup ? t('auth.newPasswordPlaceholder') : t('auth.passwordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {isSignup && (
                <p className="text-sm text-gray-500 mt-1">{t('auth.passwordMinLength')}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                isSignup ? t('auth.signUpButton') : t('auth.signInButton')
              )}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-blue-600 hover:text-blue-500 text-sm"
            >
              {isSignup ? t('auth.alreadyHaveAccount') : t('auth.needAccount')}
            </button>
            
            {!isSignup && (
              <a
                href="/forgot-password"
                className="text-blue-600 hover:text-blue-500 text-sm"
              >
                {t('auth.forgotPassword')}
              </a>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}