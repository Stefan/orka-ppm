'use client'

import React, { useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import { Loader, AlertTriangle, RefreshCw, LogIn, Shield } from 'lucide-react'
import { Button } from '../ui/Button'
import { Card, CardContent, CardHeader } from '../ui/Card'
import { diagnosticCollector } from '@/lib/diagnostics/diagnostic-collector'
import { errorReportingService } from '@/lib/diagnostics/error-reporting'

interface AuthenticationGuardProps {
  children: ReactNode
  fallbackComponent?: React.ComponentType<AuthFallbackProps>
  enableGuestMode?: boolean
  retryAttempts?: number
  showLoadingSpinner?: boolean
  redirectToLogin?: boolean
}

export interface AuthFallbackProps {
  authState: AuthState
  onRetry: () => void
  onLogin: () => void
  retryCount: number
}

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error: Error | null
  retryCount: number
  hasTimedOut: boolean
}

export const AuthenticationGuard: React.FC<AuthenticationGuardProps> = ({
  children,
  fallbackComponent: CustomFallback,
  enableGuestMode = false,
  retryAttempts = 3,
  showLoadingSpinner = true,
  redirectToLogin = true
}) => {
  const { session, user, loading, error, clearSession } = useAuth()
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    retryCount: 0,
    hasTimedOut: false
  })
  const [isRetrying, setIsRetrying] = useState(false)

  // Authentication timeout (10 seconds)
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        if (loading) {
          setAuthState(prev => ({ ...prev, hasTimedOut: true, isLoading: false }))
          diagnosticCollector.logAuthenticationError(
            new Error('Authentication timeout'),
            { timeout: 10000, retryCount: authState.retryCount }
          )
        }
      }, 10000)

      return () => clearTimeout(timeout)
    }
    // Return undefined when not loading (satisfies TypeScript)
    return undefined
  }, [loading, authState.retryCount, diagnosticCollector])

  // Update auth state based on provider state
  useEffect(() => {
    setAuthState(prev => ({
      ...prev,
      isAuthenticated: !!session && !!user,
      isLoading: loading && !prev.hasTimedOut,
      error: error ? new Error(error.message) : null
    }))

    // Update diagnostic collector with auth state
    diagnosticCollector.updateSessionInfo({
      userId: user?.id || '',
      isAuthenticated: !!session && !!user
    })

    // Log authentication errors
    if (error) {
      diagnosticCollector.logAuthenticationError(error, {
        userId: user?.id,
        sessionExists: !!session,
        retryCount: authState.retryCount
      })

      errorReportingService.reportCriticalError(error, 'AuthenticationGuard', {
        context: 'authentication_failure',
        userId: user?.id,
        sessionExists: !!session
      })
    }
  }, [session, user, loading, error, authState.retryCount, diagnosticCollector, errorReportingService])

  const handleRetry = async () => {
    if (authState.retryCount >= retryAttempts) {
      return
    }

    setIsRetrying(true)
    setAuthState(prev => ({
      ...prev,
      retryCount: prev.retryCount + 1,
      hasTimedOut: false,
      isLoading: true,
      error: null
    }))

    diagnosticCollector.logUserAction({
      action: 'auth_retry',
      component: 'AuthenticationGuard',
      data: {
        retryCount: authState.retryCount + 1,
        maxRetries: retryAttempts
      }
    })

    try {
      // Clear any existing session errors
      if (error) {
        await clearSession()
      }

      // Wait a moment before retrying
      await new Promise(resolve => setTimeout(resolve, 1000))

      // The auth provider will handle the retry automatically
      // by re-checking the session
    } catch (err) {
      console.error('Retry failed:', err)
      setAuthState(prev => ({
        ...prev,
        error: err instanceof Error ? err : new Error('Retry failed'),
        isLoading: false
      }))
    } finally {
      setIsRetrying(false)
    }
  }

  const handleLogin = () => {
    diagnosticCollector.logUserAction({
      action: 'auth_login_redirect',
      component: 'AuthenticationGuard',
      data: {
        retryCount: authState.retryCount,
        enableGuestMode
      }
    })

    if (redirectToLogin) {
      window.location.href = '/'
    }
  }

  // Show loading state
  if (authState.isLoading && showLoadingSpinner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Authenticating...
            </h2>
            <p className="text-gray-600">
              Please wait while we verify your session
            </p>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Show error state or authentication failure
  if (authState.error || authState.hasTimedOut || (!authState.isAuthenticated && !enableGuestMode)) {
    // Use custom fallback if provided
    if (CustomFallback) {
      return (
        <CustomFallback
          authState={authState}
          onRetry={handleRetry}
          onLogin={handleLogin}
          retryCount={authState.retryCount}
        />
      )
    }

    // Default authentication error UI
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              {authState.hasTimedOut ? (
                <AlertTriangle className="w-8 h-8 text-red-600" />
              ) : (
                <Shield className="w-8 h-8 text-red-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {authState.hasTimedOut ? 'Authentication Timeout' : 'Authentication Required'}
            </h2>
            <p className="text-gray-600">
              {authState.hasTimedOut 
                ? 'Authentication is taking longer than expected. Please try again.'
                : authState.error 
                  ? `Authentication failed: ${authState.error.message}`
                  : 'Please sign in to access the dashboard.'
              }
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {authState.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">
                  <strong>Error:</strong> {authState.error.message}
                </p>
                {authState.retryCount > 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Retry attempts: {authState.retryCount}/{retryAttempts}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              {authState.retryCount < retryAttempts && (authState.error || authState.hasTimedOut) && (
                <Button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Retry Authentication'}
                </Button>
              )}
              
              <Button
                variant="secondary"
                onClick={handleLogin}
                className="flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                Go to Login
              </Button>
            </div>

            {enableGuestMode && (
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600 text-center mb-3">
                  Or continue with limited functionality
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    diagnosticCollector.logUserAction({
                      action: 'auth_guest_mode',
                      component: 'AuthenticationGuard'
                    })
                    // Allow access to children in guest mode
                  }}
                  className="w-full"
                >
                  Continue as Guest
                </Button>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Debug Information
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded-md">
                  <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                    {JSON.stringify({
                      hasSession: !!session,
                      hasUser: !!user,
                      loading,
                      error: error?.message,
                      retryCount: authState.retryCount,
                      hasTimedOut: authState.hasTimedOut,
                      enableGuestMode
                    }, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Authentication successful or guest mode enabled
  return <>{children}</>
}

export default AuthenticationGuard