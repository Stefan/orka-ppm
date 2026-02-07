/**
 * Legacy generic API helpers (get, post, put, del, apiRequest, getApiUrl).
 * For app requests and Next.js proxy usage, prefer @/lib/api (client, supabase, auth).
 */

// API Configuration
// Prefer env; in production when unset use same-origin so Next.js rewrites can proxy (no localhost in bundle).
const _baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:8001')
export const API_CONFIG = {
  baseUrl: _baseUrl,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
}

// API Error types
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// Request configuration
export interface RequestConfig extends RequestInit {
  timeout?: number
  retries?: number
  baseUrl?: string
}

// Response wrapper
export interface APIResponse<T = any> {
  data: T
  success: boolean
  message?: string
  errors?: string[]
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

/**
 * Get the full API URL for an endpoint.
 * When base is same-origin (''), prefix with /api so Next.js rewrites proxy to backend.
 */
export function getApiUrl(endpoint: string, baseUrl?: string): string {
  const base = baseUrl ?? API_CONFIG.baseUrl
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  if (base.startsWith('http')) {
    return `${base}${cleanEndpoint}`
  }
  // Same-origin: request /api/... so Next.js rewrites forward to backend
  const path = (base === '' && !cleanEndpoint.startsWith('/api')) ? `/api${cleanEndpoint}` : `${base}${cleanEndpoint}`
  return path
}

/**
 * Make an API request with automatic retry and error handling
 */
export async function apiRequest<T = any>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<APIResponse<T>> {
  const {
    timeout = API_CONFIG.timeout,
    retries = API_CONFIG.retryAttempts,
    baseUrl,
    ...requestConfig
  } = config

  const url = getApiUrl(endpoint, baseUrl)
  
  // Default headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  // Add custom headers if provided
  if (requestConfig.headers) {
    if (requestConfig.headers instanceof Headers) {
      requestConfig.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(requestConfig.headers)) {
      requestConfig.headers.forEach(([key, value]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, requestConfig.headers)
    }
  }

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token')
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  }

  const makeRequest = async (): Promise<APIResponse<T>> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...requestConfig,
        headers,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type')
      let responseData: any

      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text()
      }

      if (!response.ok) {
        throw new APIError(
          responseData.message || `HTTP ${response.status}`,
          response.status,
          responseData.code,
          responseData
        )
      }

      // Normalize response format
      if (typeof responseData === 'object' && responseData !== null) {
        return {
          data: responseData.data || responseData,
          success: responseData.success !== false,
          message: responseData.message,
          errors: responseData.errors,
          meta: responseData.meta
        }
      }

      return {
        data: responseData as T,
        success: true
      }
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new APIError('Request timeout', 408, 'TIMEOUT')
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new APIError('Network error', 0, 'NETWORK_ERROR')
      }

      throw error
    }
  }

  // Retry logic
  let lastError: any
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await makeRequest()
    } catch (error) {
      lastError = error

      // Don't retry on client errors (4xx) except 408 (timeout)
      if (error instanceof APIError && error.status >= 400 && error.status < 500 && error.status !== 408) {
        throw error
      }

      // Don't retry on the last attempt
      if (attempt === retries) {
        throw error
      }

      // Exponential backoff
      const delay = API_CONFIG.retryDelay * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * GET request helper
 */
export async function get<T = any>(
  endpoint: string,
  config?: RequestConfig
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { ...config, method: 'GET' })
}

/**
 * POST request helper
 */
export async function post<T = any>(
  endpoint: string,
  data?: any,
  config?: RequestConfig
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...config,
    method: 'POST',
    body: data ? JSON.stringify(data) : null
  })
}

/**
 * PUT request helper
 */
export async function put<T = any>(
  endpoint: string,
  data?: any,
  config?: RequestConfig
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...config,
    method: 'PUT',
    body: data ? JSON.stringify(data) : null
  })
}

/**
 * PATCH request helper
 */
export async function patch<T = any>(
  endpoint: string,
  data?: any,
  config?: RequestConfig
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...config,
    method: 'PATCH',
    body: data ? JSON.stringify(data) : null
  })
}

/**
 * DELETE request helper
 */
export async function del<T = any>(
  endpoint: string,
  config?: RequestConfig
): Promise<APIResponse<T>> {
  return apiRequest<T>(endpoint, { ...config, method: 'DELETE' })
}

/**
 * Upload file helper
 */
export async function uploadFile<T = any>(
  endpoint: string,
  file: File,
  additionalData?: Record<string, any>,
  config?: RequestConfig
): Promise<APIResponse<T>> {
  const formData = new FormData()
  formData.append('file', file)

  if (additionalData) {
    Object.entries(additionalData).forEach(([key, value]) => {
      formData.append(key, typeof value === 'string' ? value : JSON.stringify(value))
    })
  }

  const { headers, ...restConfig } = config || {}
  
  return apiRequest<T>(endpoint, {
    ...restConfig,
    method: 'POST',
    body: formData,
    headers: {
      // Don't set Content-Type for FormData, let the browser set it
      ...headers
    }
  })
}

/**
 * Download file helper
 */
export async function downloadFile(
  endpoint: string,
  filename?: string,
  config?: RequestConfig
): Promise<void> {
  const response = await fetch(getApiUrl(endpoint), {
    ...config,
    headers: {
      ...config?.headers
    }
  })

  if (!response.ok) {
    throw new APIError(`HTTP ${response.status}`, response.status)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof APIError) {
    return error.status >= 500 || error.status === 408 || error.status === 0
  }
  return false
}

/**
 * Format API error for display
 */
export function formatAPIError(error: any): string {
  if (error instanceof APIError) {
    return error.message
  }
  
  if (error instanceof Error) {
    return error.message
  }
  
  return 'An unexpected error occurred'
}

// Export default object with all functions
export default {
  apiRequest,
  get,
  post,
  put,
  patch,
  del,
  uploadFile,
  downloadFile,
  getApiUrl,
  isRetryableError,
  formatAPIError,
  APIError
}