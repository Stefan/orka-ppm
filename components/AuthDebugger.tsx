'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { env } from '../lib/env'
import { testSupabaseAuth, testSupabaseLogin } from '../lib/auth-test'
import { testSupabaseConnection, safeSupabaseSignUp } from '../lib/supabase-safe'

export default function AuthDebugger() {
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [testResult, setTestResult] = useState<string>('')
  const [testEmail, setTestEmail] = useState('test@example.com')
  const [testPassword, setTestPassword] = useState('testpassword123')

  const runDiagnostics = () => {
    const info = [
      `Environment Variables:`,
      `- NEXT_PUBLIC_SUPABASE_URL: ${env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING'}`,
      `- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? `${env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'MISSING'}`,
      `- NEXT_PUBLIC_API_URL: ${env.NEXT_PUBLIC_API_URL || 'MISSING'}`,
      ``,
      `URL Validation:`,
      `- Supabase URL valid: ${isValidUrl(env.NEXT_PUBLIC_SUPABASE_URL)}`,
      `- API URL valid: ${isValidUrl(env.NEXT_PUBLIC_API_URL)}`,
      `- Auth endpoint: ${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`,
      ``,
      `Supabase Client:`,
      `- Client created: ${!!supabase}`,
      `- Auth available: ${!!supabase.auth}`,
      ``,
      `Browser Info:`,
      `- User Agent: ${navigator.userAgent}`,
      `- Fetch available: ${typeof fetch !== 'undefined'}`,
    ].join('\n')
    
    setDebugInfo(info)
  }

  const testSupabaseJS = async () => {
    try {
      setTestResult('Testing Supabase JS authentication...')
      
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        setTestResult(`Supabase JS test failed: ${error.message}`)
      } else {
        setTestResult(`Supabase JS test successful. Session: ${data.session ? 'Active' : 'None'}`)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setTestResult(`Supabase JS test error: ${errorMessage}`)
    }
  }

  const testConnection = async () => {
    try {
      setTestResult('Testing Supabase connection...')
      
      const result = await testSupabaseConnection()
      setTestResult(`Connection test: ${result.success ? 'SUCCESS' : 'FAILED'}\nStatus: ${result.status}\nMessage: ${result.message}\nURL: ${result.url}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setTestResult(`Connection test error: ${errorMessage}`)
    }
  }

  const testSafeAuth = async () => {
    try {
      setTestResult('Testing safe authentication...')
      
      const result = await safeSupabaseSignUp(testEmail, testPassword)
      if (result.error) {
        setTestResult(`Safe auth failed: ${result.error.message}`)
      } else {
        setTestResult(`Safe auth successful: ${JSON.stringify(result.data, null, 2)}`)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setTestResult(`Safe auth error: ${errorMessage}`)
    }
  }

  const testDirectAuth = async () => {
    try {
      setTestResult('Testing direct API authentication...')
      
      const result = await testSupabaseAuth(testEmail, testPassword)
      setTestResult(`Direct API test successful: ${JSON.stringify(result, null, 2)}`)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setTestResult(`Direct API test failed: ${errorMessage}`)
    }
  }

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg space-y-4">
      <h3 className="font-bold text-lg">🔧 Authentication Debugger</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={runDiagnostics}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          🔍 Run Diagnostics
        </button>
        
        <button
          onClick={testConnection}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          🌐 Test Connection
        </button>

        <button
          onClick={testSupabaseJS}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          📦 Test Supabase JS
        </button>

        <button
          onClick={testSafeAuth}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        >
          🛡️ Test Safe Auth
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="email"
          placeholder="Test Email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          className="px-3 py-2 border rounded"
        />
        <input
          type="password"
          placeholder="Test Password"
          value={testPassword}
          onChange={(e) => setTestPassword(e.target.value)}
          className="px-3 py-2 border rounded"
        />
      </div>

      {debugInfo && (
        <div className="bg-white p-3 rounded border">
          <h4 className="font-semibold mb-2">📊 Diagnostic Info:</h4>
          <pre className="text-sm whitespace-pre-wrap font-mono">{debugInfo}</pre>
        </div>
      )}

      {testResult && (
        <div className="bg-white p-3 rounded border">
          <h4 className="font-semibold mb-2">🧪 Test Result:</h4>
          <pre className="text-sm whitespace-pre-wrap font-mono">{testResult}</pre>
        </div>
      )}
    </div>
  )
}