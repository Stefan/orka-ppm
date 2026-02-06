'use client'

import React, { useState } from 'react'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { supabase, ENV_CONFIG } from '../../lib/api/supabase-minimal'
import { useAutoPrefetch } from '../../hooks/useRoutePrefetch'
import { GlobalLanguageSelector } from '../../components/navigation/GlobalLanguageSelector'
import { useTranslations } from '@/lib/i18n/context'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const { session, loading } = useAuth()
  const { t } = useTranslations()

  // Prefetch /dashboards route for instant navigation
  useAutoPrefetch(['/dashboards'], 1000)

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}
      >
        <div className="text-center" style={{ textAlign: 'center' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" style={{ width: 48, height: 48, borderWidth: 2, borderColor: '#2563eb', borderRadius: '50%', borderTopColor: 'transparent' }} />
          <p className="mt-4 text-gray-600 dark:text-slate-400" style={{ marginTop: 16, color: '#4b5563' }}>{t('auth.loading')}</p>
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
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}
    >
      <div className="text-center" style={{ textAlign: 'center' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" style={{ width: 48, height: 48, borderWidth: 2, borderColor: '#2563eb', borderRadius: '50%', borderTopColor: 'transparent' }} />
        <p className="mt-4 text-gray-600 dark:text-slate-400" style={{ marginTop: 16, color: '#4b5563' }}>{t('auth.redirecting')}</p>
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

  React.useEffect(() => {
    console.log('🔍 LoginForm Environment Check:', { url: ENV_CONFIG.supabaseUrl?.slice(0, 30), keyLength: ENV_CONFIG.supabaseAnonKey?.length })
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

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

    if (!ENV_CONFIG.supabaseUrl || !ENV_CONFIG.supabaseAnonKey ||
        ENV_CONFIG.supabaseUrl === 'https://placeholder.supabase.co' ||
        ENV_CONFIG.supabaseAnonKey === 'placeholder-anon-key') {
      setError('❌ CONFIGURATION ERROR: Supabase environment variables are not configured.')
      setLoading(false)
      return
    }

    try {
      const { data, error: authError } = isSignup
        ? await supabase.auth.signUp({ email: trimmedEmail, password: trimmedPassword, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError(t('auth.errors.invalidCredentials'))
        } else if (authError.message.includes('Email not confirmed')) {
          setError(t('auth.errors.emailNotConfirmed'))
        } else if (authError.message.includes('User already registered')) {
          setError(t('auth.errors.userAlreadyRegistered'))
        } else {
          setError(`Authentication failed: ${authError.message}`)
        }
        setLoading(false)
        return
      }

      if (isSignup) {
        setError(data.user && !data.user.email_confirmed_at ? t('auth.success.accountCreated') : t('auth.success.accountConfirmed'))
      } else {
        setError(t('auth.success.loginSuccess'))
        setTimeout(() => { window.location.href = '/dashboards' }, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errors.unexpectedError'))
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50 py-12 px-4 sm:px-6 lg:px-8"
      style={{ minHeight: '100vh', background: '#f9fafb', color: '#111827' }}
    >
      <div className="fixed top-4 right-4 z-50">
        <GlobalLanguageSelector variant="topbar" />
      </div>

      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-slate-100" style={{ color: '#111827' }}>
            {isSignup ? t('auth.signUp') : t('auth.signIn')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            {t('auth.subtitle')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-5">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              label={t('auth.email')}
              placeholder={t('auth.emailPlaceholder')}
              size="md"
            />
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1 required">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 bg-white dark:bg-slate-800 text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors px-4 py-2 text-base pr-12"
                  placeholder={isSignup ? t('auth.newPasswordPlaceholder') : t('auth.passwordPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
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
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm"
            >
              {isSignup ? t('auth.alreadyHaveAccount') : t('auth.needAccount')}
            </button>
            {!isSignup && (
              <a href="/forgot-password" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm">
                {t('auth.forgotPassword')}
              </a>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
