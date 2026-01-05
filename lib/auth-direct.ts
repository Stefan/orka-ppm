// Direct authentication without Supabase JS SDK to avoid fetch issues
import { env } from './env'

interface AuthResult {
  success: boolean
  data?: any
  error?: string
  message?: string
}

// Safe fetch wrapper that handles invalid values
async function safeFetch(url: string, options: RequestInit): Promise<Response> {
  // Validate URL before making request
  try {
    new URL(url)
  } catch (error) {
    throw new Error(`Invalid URL: ${url}`)
  }

  // Clean headers to avoid invalid values
  const cleanHeaders: Record<string, string> = {}
  if (options.headers) {
    const headers = options.headers as Record<string, string>
    for (const [key, value] of Object.entries(headers)) {
      if (value && typeof value === 'string' && value.trim()) {
        cleanHeaders[key] = value.trim()
      }
    }
  }

  const cleanOptions: RequestInit = {
    ...options,
    headers: cleanHeaders,
  }

  console.log('Making safe fetch request to:', url)
  console.log('With options:', cleanOptions)

  return fetch(url, cleanOptions)
}

export async function directSignUp(email: string, password: string): Promise<AuthResult> {
  try {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`
    const apiKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('Direct signup attempt:', { url, email, apiKeyLength: apiKey.length })

    if (!url || !apiKey) {
      return {
        success: false,
        error: 'Missing Supabase configuration'
      }
    }

    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password,
      }),
    })

    console.log('Signup response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Signup error:', errorText)
      
      // Try to parse error message
      try {
        const errorData = JSON.parse(errorText)
        return {
          success: false,
          error: errorData.error_description || errorData.msg || 'Signup failed'
        }
      } catch {
        return {
          success: false,
          error: `Signup failed: ${response.status} ${response.statusText}`
        }
      }
    }

    const data = await response.json()
    console.log('Signup successful:', data)

    return {
      success: true,
      data,
      message: 'Account created successfully! Please check your email to confirm.'
    }
  } catch (error) {
    console.error('Direct signup error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown signup error'
    }
  }
}

export async function directSignIn(email: string, password: string): Promise<AuthResult> {
  try {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`
    const apiKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('Direct signin attempt:', { url, email, apiKeyLength: apiKey.length })

    if (!url || !apiKey) {
      return {
        success: false,
        error: 'Missing Supabase configuration'
      }
    }

    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password,
      }),
    })

    console.log('Signin response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Signin error:', errorText)
      
      // Try to parse error message
      try {
        const errorData = JSON.parse(errorText)
        return {
          success: false,
          error: errorData.error_description || errorData.msg || 'Login failed'
        }
      } catch {
        return {
          success: false,
          error: `Login failed: ${response.status} ${response.statusText}`
        }
      }
    }

    const data = await response.json()
    console.log('Signin successful:', data)

    return {
      success: true,
      data,
      message: 'Login successful!'
    }
  } catch (error) {
    console.error('Direct signin error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown signin error'
    }
  }
}

// Test connection function
export async function testConnection(): Promise<AuthResult> {
  try {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`
    const apiKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const response = await safeFetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    return {
      success: response.ok,
      message: response.ok ? 'Connection successful' : `Connection failed: ${response.status}`,
      data: {
        status: response.status,
        url: url,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    }
  }
}