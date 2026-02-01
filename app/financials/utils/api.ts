import { getApiUrl } from '../../../lib/api'
import { 
  Project, 
  BudgetVariance, 
  FinancialAlert, 
  ComprehensiveFinancialReport,
  CSVImportHistory,
  CSVUploadResult
} from '../types'

export async function fetchProjects(accessToken: string): Promise<Project[]> {
  try {
    const url = getApiUrl('/projects/')
    console.log('Fetching projects from:', url)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    console.log('Projects response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('Projects data:', data)
      return Array.isArray(data) ? data as Project[] : []
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
    console.error('Failed to fetch projects:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)

      // Check if it's an abort error (timeout)
      if (error.name === 'AbortError') {
        console.warn('⏰ REQUEST TIMEOUT: Projects request timed out after 10 seconds')
        console.warn('💡 This might indicate:')
        console.warn('   - Backend server is slow to respond')
        console.warn('   - Network connectivity issues')
        console.warn('   - Heavy database load')
        console.warn('')
        console.warn('Using mock data for development...')
        // Return mock data for development
        return getMockProjects()
      }

      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('🚨 NETWORK ERROR: Backend server is not running!')
        console.warn('💡 To fix this:')
        console.warn('   1. Open a new terminal')
        console.warn('   2. Run: cd backend && bash start_server.sh')
        console.warn('   3. Or run: npm run dev:backend')
        console.warn('   4. Refresh this page')
        console.warn('')
        console.warn('Using mock data for development...')
        // Return mock data for development
        return getMockProjects()
      }
    }
    return []
  }
}

export async function fetchBudgetVariance(
  projectId: string,
  currency: string,
  accessToken: string
): Promise<BudgetVariance | null> {
  try {
    const url = getApiUrl(`/projects/${projectId}/budget-variance?currency=${currency}`)
    console.log('Fetching budget variance from:', url)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

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
      console.log('Budget variance data:', data)
      return data
    }

    // Silently handle 404 - endpoint may not be implemented
    if (response.status === 404) {
      console.log('Budget variance endpoint not found (404)')
      return null
    }

    console.error('Budget variance request failed:', response.status, response.statusText)
    return null
  } catch (error) {
    console.error('Failed to fetch budget variance:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)

      // Check if it's an abort error (timeout)
      if (error.name === 'AbortError') {
        console.warn('⏰ REQUEST TIMEOUT: Budget variance request timed out after 10 seconds')
        console.warn('Using null for budget variance (graceful degradation)')
      }

      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('Network error: Backend server is not running. Skipping budget variance.')
      }
    }
    return null
  }
}

export async function fetchFinancialAlerts(accessToken: string): Promise<FinancialAlert[]> {
  try {
    const url = getApiUrl('/financial-tracking/budget-alerts?threshold_percentage=80')
    console.log('Fetching financial alerts from:', url)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    console.log('Financial alerts response status:', response.status)

    if (response.ok) {
      const data = await response.json()
      console.log('Financial alerts data:', data)
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
    console.error('Failed to fetch financial alerts:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)

      // Check if it's an abort error (timeout)
      if (error.name === 'AbortError') {
        console.warn('⏰ REQUEST TIMEOUT: Financial alerts request timed out after 10 seconds')
        console.warn('💡 This might indicate:')
        console.warn('   - Backend server is slow to respond')
        console.warn('   - Network connectivity issues')
        console.warn('   - Heavy database load')
        console.warn('')
        console.warn('Using mock data for development...')
        // Return mock data for development
        return getMockFinancialAlerts()
      }

      // Check if it's a network error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn('🚨 NETWORK ERROR: Backend server is not running!')
        console.warn('💡 To fix this:')
        console.warn('   1. Open a new terminal')
        console.warn('   2. Run: cd backend && bash start_server.sh')
        console.warn('   3. Or run: npm run dev:backend')
        console.warn('   4. Refresh this page')
        console.warn('')
        console.warn('Using mock data for development...')
        // Return mock data for development
        return getMockFinancialAlerts()
      }
    }
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
      getApiUrl(`/financial-tracking/comprehensive-report?currency=${currency}&include_trends=true`), 
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
    const response = await fetch(getApiUrl('/csv-import/history'), {
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
    getApiUrl(`/csv-import/upload?import_type=${importType}`), 
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
  const response = await fetch(getApiUrl(`/csv-import/template/${importType}`), {
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