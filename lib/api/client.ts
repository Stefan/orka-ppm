// Browser API type declarations
declare global {
  interface RequestInit {
    method?: string
    headers?: HeadersInit
    body?: BodyInit | null
    mode?: RequestMode
    credentials?: RequestCredentials
    cache?: RequestCache
    redirect?: RequestRedirect
    referrer?: string
    referrerPolicy?: ReferrerPolicy
    integrity?: string
    keepalive?: boolean
    signal?: AbortSignal | null
  }
}

// Mock data for fallback when API is unavailable
const MOCK_DATA = {
  '/projects': [
    {
      "id": "1",
      "name": "Office Complex Phase 1",
      "status": "active",
      "health": "green",
      "budget": 150000,
      "created_at": "2024-01-15T10:00:00Z"
    },
    {
      "id": "2", 
      "name": "Residential Tower A",
      "status": "active",
      "health": "yellow",
      "budget": 200000,
      "created_at": "2024-01-20T10:00:00Z"
    },
    {
      "id": "3",
      "name": "Shopping Center Renovation", 
      "status": "active",
      "health": "red",
      "budget": 80000,
      "created_at": "2024-02-01T10:00:00Z"
    }
  ],
  '/optimized/dashboard/quick-stats': {
    "quick_stats": {
      "total_projects": 12,
      "active_projects": 8,
      "health_distribution": {
        "green": 6,
        "yellow": 4,
        "red": 2
      },
      "critical_alerts": 2,
      "at_risk_projects": 4
    },
    "kpis": {
      "project_success_rate": 85,
      "budget_performance": 92,
      "timeline_performance": 78,
      "average_health_score": 2.1,
      "resource_efficiency": 88,
      "active_projects_ratio": 67
    }
  },
  '/optimized/dashboard/projects-summary': [
    {
      "id": "1",
      "name": "Office Complex Phase 1",
      "status": "active",
      "health": "green",
      "budget": 150000,
      "actual": 145000,
      "variance": -5000,
      "variance_percentage": -3.3,
      "created_at": "2024-01-15T10:00:00Z"
    },
    {
      "id": "2", 
      "name": "Residential Tower A",
      "status": "active",
      "health": "yellow",
      "budget": 200000,
      "actual": 210000,
      "variance": 10000,
      "variance_percentage": 5.0,
      "created_at": "2024-01-20T10:00:00Z"
    }
  ]
}

// Get mock data for an endpoint
function getMockData(endpoint: string): any {
  // Handle parameterized endpoints
  if (endpoint.includes('/projects/') && endpoint.includes('/scenarios')) {
    return {
      "scenarios": [
        {
          "id": "scenario-1",
          "project_id": endpoint.split('/')[2],
          "name": "Accelerated Timeline",
          "description": "Complete project 2 weeks earlier by adding resources",
          "timeline_impact": {
            "duration_change": -14,
            "critical_path_affected": true
          },
          "cost_impact": {
            "cost_change": 15000,
            "cost_change_percentage": 10.0
          },
          "resource_impact": {
            "utilization_changes": {
              "developers": 25.0,
              "designers": 15.0
            }
          },
          "created_at": "2024-01-08T10:00:00Z"
        }
      ]
    }
  }
  
  return MOCK_DATA[endpoint as keyof typeof MOCK_DATA] || null
}

// API configuration with fallbacks - Use local development server
export const API_CONFIG = {
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://orka-ppm.onrender.com' 
    : 'http://localhost:3000', // Local Next.js development server
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
} as const

// API URL builder with validation and fallback
export function getApiUrl(endpoint: string): string {
  const baseUrl = API_CONFIG.baseURL
  
  if (!baseUrl) {
    console.warn('API_URL not configured, using localhost fallback')
    return `http://localhost:3000/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  }
  
  // Validate URL format
  try {
    new URL(baseUrl)
  } catch (error) {
    console.error('Invalid API_URL format:', baseUrl)
    throw new Error(`Invalid API URL: ${baseUrl}`)
  }
  
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  // Remove trailing slash from baseUrl and combine with /api prefix
  const cleanBaseUrl = baseUrl.replace(/\/$/, '')
  
  const fullUrl = `${cleanBaseUrl}/api${normalizedEndpoint}`
  
  // Validate final URL
  try {
    new URL(fullUrl)
    return fullUrl
  } catch (error) {
    console.error('Invalid final URL:', fullUrl)
    throw new Error(`Invalid final URL: ${fullUrl}`)
  }
}

// Fetch wrapper with error handling and mock fallback
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    return data as T
  } catch (error: unknown) {
    console.error('API request error:', error)
    
    // If API fails, try mock data fallback
    const mockData = getMockData(endpoint)
    if (mockData) {
      console.warn(`🔄 Using mock data for ${endpoint}`)
      return mockData as T
    }
    
    throw error instanceof Error ? error : new Error('Unknown API error')
  }
}