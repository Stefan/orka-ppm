/**
 * Resilient API Fetch Utility
 * Provides robust error handling, timeouts, retries, and graceful degradation
 */

export interface ResilientFetchOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
  fallbackData?: any
  silentFail?: boolean
}

export interface FetchResult<T> {
  data: T | null
  error: Error | null
  isFromCache: boolean
  isFromFallback: boolean
  status?: number
}

/**
 * Resilient fetch with automatic retries, timeouts, and fallbacks
 */
export async function resilientFetch<T = any>(
  url: string,
  options: ResilientFetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeout = 5000,
    retries = 2,
    retryDelay = 1000,
    fallbackData = null,
    silentFail = false,
    ...fetchOptions
  } = options

  let lastError: Error | null = null
  
  // Try with retries
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      return {
        data: data as T,
        error: null,
        isFromCache: false,
        isFromFallback: false,
        status: response.status,
      }
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      // Don't retry on last attempt
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        continue
      }
    }
  }
  
  // All retries failed
  if (!silentFail) {
    console.error(`Failed to fetch ${url} after ${retries + 1} attempts:`, lastError)
  }
  
  // Return fallback data if available
  if (fallbackData !== null) {
    return {
      data: fallbackData as T,
      error: lastError,
      isFromCache: false,
      isFromFallback: true,
    }
  }
  
  // Return error result
  return {
    data: null,
    error: lastError,
    isFromCache: false,
    isFromFallback: false,
  }
}

/**
 * Batch fetch multiple endpoints with individual error handling
 */
export async function batchResilientFetch<T extends Record<string, any>>(
  requests: Record<keyof T, { url: string; options?: ResilientFetchOptions }>
): Promise<Record<keyof T, FetchResult<any>>> {
  const entries = Object.entries(requests) as [keyof T, { url: string; options?: ResilientFetchOptions }][]
  
  const results = await Promise.all(
    entries.map(async ([key, { url, options }]) => {
      const result = await resilientFetch(url, options)
      return [key, result] as const
    })
  )
  
  return Object.fromEntries(results) as Record<keyof T, FetchResult<any>>
}
