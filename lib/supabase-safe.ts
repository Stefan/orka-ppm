// Safe Supabase client with fallback mechanisms
import { env } from './env'

// Manual fetch-based auth functions as fallback
export async function safeSupabaseSignUp(email: string, password: string) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`
  const apiKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('Attempting signup with URL:', url)
  console.log('API Key length:', apiKey.length)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    console.log('Signup response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Signup error response:', errorText)
      throw new Error(`Signup failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Signup successful:', data)
    return { data, error: null }
  } catch (error) {
    console.error('Signup fetch error:', error)
    return { 
      data: null, 
      error: { 
        message: error instanceof Error ? error.message : 'Unknown signup error' 
      } 
    }
  }
}

export async function safeSupabaseSignIn(email: string, password: string) {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`
  const apiKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('Attempting signin with URL:', url)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    console.log('Signin response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Signin error response:', errorText)
      throw new Error(`Signin failed: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Signin successful:', data)
    return { data, error: null }
  } catch (error) {
    console.error('Signin fetch error:', error)
    return { 
      data: null, 
      error: { 
        message: error instanceof Error ? error.message : 'Unknown signin error' 
      } 
    }
  }
}

// Test function to validate environment and connectivity
export async function testSupabaseConnection() {
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`
  const apiKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
    })

    return {
      success: response.ok,
      status: response.status,
      url: url,
      message: response.ok ? 'Connection successful' : `HTTP ${response.status}`,
    }
  } catch (error) {
    return {
      success: false,
      status: 0,
      url: url,
      message: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}