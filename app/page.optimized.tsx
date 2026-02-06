'use client'

import React, { useState } from 'react'
import { useAuth } from './providers/SupabaseAuthProvider'
import Sidebar from '../components/navigation/Sidebar'
import { supabase, ENV_CONFIG } from '../lib/api/supabase-minimal'
import { useAutoPrefetch } from '../hooks/useRoutePrefetch'

export default function Home() {
  const { session, loading } = useAuth()

  // Prefetch /dashboards route for instant navigation
  useAutoPrefetch(['/dashboards'], 1000)

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1>Willkommen zu PPM SaaS</h1>
        {/* Füge Links zu Dashboards etc. hinzu */}
      </main>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Trim and validate inputs
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    // Enhanced input validation
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password')
      setLoading(false)
      return
    }

    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    if (trimmedPassword.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    // Check if Supabase is properly configured
    if (!ENV_CONFIG.supabaseUrl || !ENV_CONFIG.supabaseAnonKey || 
        ENV_CONFIG.supabaseUrl === 'https://placeholder.supabase.co' ||
        ENV_CONFIG.supabaseAnonKey === 'placeholder-anon-key') {
      setError('❌ CONFIGURATION ERROR: Supabase environment variables are not configured. Authentication is disabled in development mode.')
      setLoading(false)
      return
    }

    try {
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
        // Specific error handling for different failure modes
        if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.')
        } else if (authError.message.includes('User already registered')) {
          setError('This email is already registered. Please sign in instead.')
        } else if (authError.message.includes('Invalid API key') || authError.message.includes('JWT')) {
          setError('❌ CONFIGURATION ERROR: Invalid API key detected. Environment variables need to be fixed.')
        } else if (authError.message.includes('NetworkError') || authError.message.includes('fetch') || authError.message.includes('CORS')) {
          setError('❌ NETWORK ERROR: Cannot connect to authentication service. CORS or network issue.')
        } else {
          setError(`Authentication failed: ${authError.message}`)
        }
        setLoading(false)
        return
      }

      // Success handling
      if (isSignup) {
        if (data.user && !data.user.email_confirmed_at) {
          setError('✅ Account created successfully! Please check your email to confirm.')
        } else {
          setError('✅ Account created and confirmed! You can now sign in.')
        }
      } else {
        setError('✅ Login successful! Redirecting to dashboard...')
        // Redirect after short delay
        setTimeout(() => {
          window.location.href = '/dashboards'
        }, 1500)
      }
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Specific fetch error handling
        if (err.message.includes('Failed to execute \'fetch\'') || err.message.includes('Invalid value')) {
          setError('❌ CRITICAL ERROR: Invalid fetch configuration. Environment variables are corrupted.')
        } else if (err.message.includes('COPY-PASTE ERROR') || err.message.includes('variable names')) {
          setError('❌ COPY-PASTE ERROR: Environment variable contains variable names instead of values.')
        } else if (err.message.includes('assignment syntax')) {
          setError('❌ ASSIGNMENT ERROR: Environment variable contains "=" assignment syntax.')
        } else if (err.message.includes('NetworkError') || err.message.includes('CORS')) {
          setError('❌ NETWORK ERROR: Cannot reach authentication service. Check CORS configuration.')
        } else {
          setError(`Unexpected error: ${err.message}`)
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-800/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-slate-100">
            {isSignup ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-slate-400">
            AI-Powered Project Portfolio Management
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 required">
                Email Address
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
                placeholder="Enter your email address"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 required">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 input-field w-full"
                placeholder={isSignup ? "Create a secure password (min. 6 characters)" : "Enter your password"}
              />
              {isSignup && (
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Password must be at least 6 characters long</p>
              )}
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
                isSignup ? 'Sign Up' : 'Sign In'
              )}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm"
            >
              {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
            
            {!isSignup && (
              <a
                href="/forgot-password"
                className="text-blue-600 dark:text-blue-400 hover:text-blue-500 text-sm"
              >
                Forgot password?
              </a>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
