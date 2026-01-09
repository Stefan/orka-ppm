'use client'

import React, { useState } from 'react'
import { useAuth } from './providers/SupabaseAuthProvider'
import Sidebar from '../components/Sidebar'
import { supabase, ENV_CONFIG } from '../lib/supabase-minimal'

export default function Home() {
  const { session } = useAuth()

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

  // Log environment configuration on component mount
  React.useEffect(() => {
    console.log('🔍 LoginForm Environment Check (Production v2):')
    console.log('- ENV_CONFIG:', ENV_CONFIG)
    console.log('- Supabase client available:', !!supabase)
    console.log('- Auth methods available:', !!supabase?.auth)
    console.log('- Validation source:', ENV_CONFIG.validationSource || 'unknown')
    console.log('- Force override active:', ENV_CONFIG.forceOverride)
    console.log('- Production mode:', ENV_CONFIG.productionMode)
    console.log('- Environment bypass:', ENV_CONFIG.environmentBypass)
    console.log('- API URL:', ENV_CONFIG.apiUrl)
    
    // Additional environment diagnostics
    console.log('🔧 Environment Diagnostics (Production v2):')
    console.log('- Using minimal config:', true)
    console.log('- Hardcoded URL length:', ENV_CONFIG.url.length)
    console.log('- Hardcoded key length:', ENV_CONFIG.keyLength)
    console.log('- Key preview:', ENV_CONFIG.keyPreview)
    console.log('- Supabase client config:', {
      url: ENV_CONFIG.url,
      keyLength: ENV_CONFIG.keyLength,
      isValid: ENV_CONFIG.isValid
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

    console.log('🚀 Starting authentication...')
    console.log('- Email:', trimmedEmail)
    console.log('- Is Signup:', isSignup)
    console.log('- ENV Config Valid:', ENV_CONFIG.isValid)
    console.log('- Force Override Active:', ENV_CONFIG.forceOverride)
    console.log('- Key Length:', ENV_CONFIG.keyLength)

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
          setError('Invalid email or password. Please check your credentials and try again.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.')
        } else if (authError.message.includes('User already registered')) {
          setError('This email is already registered. Please sign in instead.')
        } else if (authError.message.includes('Invalid API key') || authError.message.includes('JWT')) {
          setError('❌ CONFIGURATION ERROR: Invalid API key detected. Environment variables need to be fixed.')
          console.error('💡 SOLUTION: Check Vercel environment variables - ANON_KEY may be corrupted')
          console.error('💡 Expected key length: ~208 chars, Current:', ENV_CONFIG.keyLength)
        } else if (authError.message.includes('NetworkError') || authError.message.includes('fetch') || authError.message.includes('CORS')) {
          setError('❌ NETWORK ERROR: Cannot connect to authentication service. CORS or network issue.')
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
      console.error('🚨 Authentication Exception:', err)
      
      if (err instanceof Error) {
        console.error('- Exception message:', err.message)
        console.error('- Exception stack:', err.stack)
        
        // ENHANCED: Specific fetch error handling for copy-paste corruption
        if (err.message.includes('Failed to execute \'fetch\'') || err.message.includes('Invalid value')) {
          setError('❌ CRITICAL ERROR: Invalid fetch configuration. Environment variables are corrupted.')
          console.error('💡 SOLUTION: Check browser console for validation errors')
          console.error('💡 Raw key length should be ~208, current ENV length:', ENV_CONFIG.keyLength)
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
          setError(`Unexpected error: ${err.message}`)
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isSignup ? 'Create your account' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            AI-Powered Project Portfolio Management
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleAuth}>
          <div className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 required">
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 required">
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
                <p className="text-sm text-gray-500 mt-1">Password must be at least 6 characters long</p>
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
                isSignup ? 'Sign Up' : 'Sign In'
              )}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-blue-600 hover:text-blue-500 text-sm"
            >
              {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
            </button>
            
            {!isSignup && (
              <a
                href="/forgot-password"
                className="text-blue-600 hover:text-blue-500 text-sm"
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