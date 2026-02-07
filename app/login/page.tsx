'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '../providers/SupabaseAuthProvider'
import { supabase, ENV_CONFIG } from '../../lib/api/supabase-minimal'
import { useAutoPrefetch } from '../../hooks/useRoutePrefetch'
import { GlobalLanguageSelector } from '../../components/navigation/GlobalLanguageSelector'
import { useTranslations } from '@/lib/i18n/context'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  )
}

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
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) {
      const msg = err === 'no_session' ? t('auth.errors.invalidCredentials') : decodeURIComponent(err)
      const suggestion = /invalid|key|secret|client/i.test(msg) ? ' Vorschlag: Überprüfe Client-ID/Secret im Supabase Dashboard (Authentication → Providers).' : ''
      setError(msg + suggestion)
    }
  }, [searchParams, t])

  React.useEffect(() => {
    console.log('🔍 LoginForm Environment Check:', { url: ENV_CONFIG.supabaseUrl?.slice(0, 30), keyLength: ENV_CONFIG.supabaseAnonKey?.length })
  }, [])

  const handleSSO = async (provider: 'google' | 'azure') => {
    setError(null)
    setSsoLoading(provider)
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      })
      if (oauthError) {
        const suggestion = /invalid|key|secret|client/i.test(oauthError.message) ? ' Vorschlag: Überprüfe Key im Supabase Dashboard.' : ''
        setError(oauthError.message + suggestion)
        setSsoLoading(null)
        return
      }
      if (data?.url) window.location.href = data.url
      else setError('SSO redirect URL not returned')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO failed')
    }
    setSsoLoading(null)
  }

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

          {!isSignup && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300 dark:border-slate-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400">Or sign in with</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSSO('google')}
                  disabled={!!ssoLoading}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  data-testid="sso-google"
                >
                  <GoogleIcon className="h-5 w-5" />
                  {ssoLoading === 'google' ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                  ) : (
                    'Google'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSSO('azure')}
                  disabled={!!ssoLoading}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-md border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  data-testid="sso-microsoft"
                >
                  <MicrosoftIcon className="h-5 w-5" />
                  {ssoLoading === 'azure' ? (
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                  ) : (
                    'Microsoft'
                  )}
                </button>
              </div>
            </div>
          )}

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
