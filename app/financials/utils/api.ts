import { 
  Project, 
  BudgetVariance, 
  FinancialAlert, 
  ComprehensiveFinancialReport,
  CSVImportHistory,
  CSVUploadResult
} from '../types'

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'

export async function fetchProjects(accessToken: string): Promise<Project[]> {
  try {
    const url = '/api/projects'
    if (isDev) console.log('Fetching projects from:', url)

    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Request timeout', 'AbortError')),
      10000
    )

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    if (isDev) console.log('Projects response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      if (isDev) console.log('Projects data:', data)
      const list = Array.isArray(data) ? data : (data?.items ?? data?.projects ?? [])
      return list as Project[]
    } else {
      console.error('Projects request failed:', response.status, response.statusText)
      try {
        const errorText = await response.text()
        console.error('Error response:', errorText)
      } catch (e) {
        console.error('Could not read error response')
      }
    }
    return []
  } catch (error) {
    const err = error instanceof Error ? error : new Error(error != null && typeof error === 'object' && 'message' in error ? String((error as Error).message) : String(error))
    const msg = err.message.toLowerCase()
    if (err.name === 'AbortError' || msg.includes('aborted')) {
      console.warn('⏰ REQUEST TIMEOUT: Projects request timed out. Using mock data.')
      return getMockProjects()
    }
    if ((err.name === 'TypeError' && msg.includes('fetch')) || msg === 'failed to fetch') {
      console.warn('🚨 NETWORK ERROR: Backend not reachable. Using mock data.')
      return getMockProjects()
    }
    console.error('Failed to fetch projects:', err)
    return []
  }
}

export async function fetchBudgetVariance(
  projectId: string,
  currency: string,
  accessToken: string
): Promise<BudgetVariance | null> {
  try {
    const url = `/api/projects/${projectId}/budget-variance?currency=${currency}`
    if (isDev) console.log('Fetching budget variance from:', url)

    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Request timeout', 'AbortError')),
      10000
    )

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      if (isDev) console.log('Budget variance data:', data)
      return data
    }

    // Silently handle 404 - endpoint may not be implemented
    if (response.status === 404) {
      if (isDev) console.log('Budget variance endpoint not found (404)')
      return null
    }

    if (isDev) console.error('Budget variance request failed:', response.status, response.statusText)
    return null
  } catch (error) {
    const err = error instanceof Error ? error : new Error(error != null && typeof error === 'object' && 'message' in error ? String((error as Error).message) : String(error))
    const msg = err.message.toLowerCase()
    if (err.name === 'AbortError' || msg.includes('aborted') || (err.name === 'TypeError' && msg.includes('fetch')) || msg === 'failed to fetch') {
      return null
    }
    console.error('Failed to fetch budget variance:', err)
    return null
  }
}

export async function fetchFinancialAlerts(accessToken: string): Promise<FinancialAlert[]> {
  try {
    const url = '/api/financial-tracking/budget-alerts?threshold_percentage=80'
    if (isDev) console.log('Fetching financial alerts from:', url)

    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException('Request timeout', 'AbortError')),
      10000
    )

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    if (isDev) console.log('Financial alerts response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      if (isDev) console.log('Financial alerts data:', data)
      // Handle both response formats
      if (data.alerts) {
        return data.alerts
      } else if (Array.isArray(data)) {
        return data
      }
      return []
    } else {
      console.error('Financial alerts request failed:', response.status, response.statusText)
      try {
        const errorText = await response.text()
        console.error('Error response:', errorText)
      } catch (e) {
        console.error('Could not read error response')
      }
    }
    return []
  } catch (error) {
    const err = error instanceof Error ? error : new Error(error != null && typeof error === 'object' && 'message' in error ? String((error as Error).message) : String(error))
    const msg = err.message.toLowerCase()
    if (err.name === 'AbortError' || msg.includes('aborted')) {
      console.warn('⏰ REQUEST TIMEOUT: Financial alerts timed out. Using mock data.')
      return getMockFinancialAlerts()
    }
    if ((err.name === 'TypeError' && msg.includes('fetch')) || msg === 'failed to fetch') {
      console.warn('🚨 NETWORK ERROR: Backend not reachable. Using mock data.')
      return getMockFinancialAlerts()
    }
    console.error('Failed to fetch financial alerts:', err)
    return []
  }
}

/**
 * Mock projects for development when backend is not available
 */
function getMockProjects(): Project[] {
  return [
    {
      id: 'mock-project-1',
      name: 'Project Alpha',
      budget: 50000,
      actual_cost: 45000,
      status: 'active',
      health: 'yellow'
    },
    {
      id: 'mock-project-2',
      name: 'Project Beta',
      budget: 75000,
      actual_cost: 78000,
      status: 'active',
      health: 'red'
    },
    {
      id: 'mock-project-3',
      name: 'Project Gamma',
      budget: 30000,
      actual_cost: 25000,
      status: 'active',
      health: 'green'
    },
    {
      id: 'mock-project-4',
      name: 'Project Delta',
      budget: 100000,
      actual_cost: null,
      status: 'planning',
      health: 'green'
    }
  ]
}

/**
 * Mock financial alerts for development when backend is not available
 */
function getMockFinancialAlerts(): FinancialAlert[] {
  return [
    {
      project_id: 'mock-project-1',
      project_name: 'Project Alpha',
      budget: 50000,
      actual_cost: 45000,
      utilization_percentage: 90,
      variance_amount: -5000,
      alert_level: 'warning',
      message: 'Budget utilization approaching 90% threshold'
    },
    {
      project_id: 'mock-project-2',
      project_name: 'Project Beta',
      budget: 75000,
      actual_cost: 78000,
      utilization_percentage: 104,
      variance_amount: 3000,
      alert_level: 'critical',
      message: 'Project is over budget by 4%'
    }
  ]
}

export async function fetchComprehensiveReport(
  currency: string, 
  accessToken: string
): Promise<ComprehensiveFinancialReport | null> {
  try {
    const response = await fetch(
      `/api/financial-tracking/comprehensive-report?currency=${currency}&include_trends=true`, 
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    )
    
    if (response.ok) {
      return await response.json()
    }
    
    // Silently handle server errors - endpoint may not be fully implemented
    if (response.status >= 500) {
      return null
    }
    
    return null
  } catch (error) {
    // Silently handle network errors - non-critical data
    return null
  }
}

export async function fetchCSVImportHistory(accessToken: string): Promise<CSVImportHistory[]> {
  try {
    const response = await fetch('/api/csv-import/history', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      return data.imports || []
    }
    return []
  } catch (error) {
    console.error('Failed to fetch CSV import history:', error)
    return []
  }
}

export async function uploadCSVFile(
  file: File, 
  importType: 'commitments' | 'actuals', 
  accessToken: string
): Promise<CSVUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch(
    `/api/csv-import/upload?import_type=${importType}`, 
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData
    }
  )
  
  if (response.ok) {
    return await response.json()
  } else {
    const error = await response.json()
    return {
      success: false,
      records_processed: 0,
      records_imported: 0,
      errors: [{ row: 0, field: 'file', message: error.detail || 'Upload failed' }],
      warnings: [],
      import_id: ''
    }
  }
}

export async function downloadCSVTemplate(
  importType: 'commitments' | 'actuals', 
  accessToken: string
): Promise<void> {
  const response = await fetch(`/api/csv-import/template/${importType}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  })
  
  if (response.ok) {
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${importType}_template.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

// Saved CSV column mappings (Cora-Surpass Phase 2.2)
export type SavedCsvMapping = {
  id: string
  user_id: string
  organization_id: string | null
  name: string
  import_type: 'commitments' | 'actuals'
  mapping: Array<{ source_header: string; target_field: string }>
  created_at: string
}

export async function fetchSavedCsvMappings(
  accessToken: string,
  importType?: 'commitments' | 'actuals'
): Promise<SavedCsvMapping[]> {
  const q = importType ? `?import_type=${importType}` : ''
  const response = await fetch(`/api/csv-import/mappings${q}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function saveCsvMapping(
  accessToken: string,
  name: string,
  importType: 'commitments' | 'actuals',
  mapping: Array<{ source_header: string; target_field: string }>
): Promise<SavedCsvMapping | null> {
  const response = await fetch('/api/csv-import/mappings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, import_type: importType, mapping }),
  })
  if (!response.ok) return null
  return response.json()
}

export async function deleteSavedCsvMapping(
  accessToken: string,
  mappingId: string
): Promise<boolean> {
  const response = await fetch(`/api/csv-import/mappings/${mappingId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  return response.status === 204 || response.status === 200
}