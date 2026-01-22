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
  const response = await fetch(getApiUrl('/projects/'), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
  })
  
  if (!response.ok) throw new Error('Failed to fetch projects')
  const data = await response.json()
  return Array.isArray(data) ? data as Project[] : []
}

export async function fetchBudgetVariance(
  projectId: string, 
  currency: string, 
  accessToken: string
): Promise<BudgetVariance | null> {
  try {
    const response = await fetch(
      getApiUrl(`/projects/${projectId}/budget-variance?currency=${currency}`), 
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
    return null
  } catch (error) {
    console.error(`Failed to fetch variance for project ${projectId}:`, error)
    return null
  }
}

export async function fetchFinancialAlerts(accessToken: string): Promise<FinancialAlert[]> {
  try {
    const response = await fetch(
      getApiUrl('/financial-tracking/budget-alerts?threshold_percentage=80'), 
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      }
    )
    
    if (response.ok) {
      const data = await response.json()
      return data.alerts || []
    }
    return []
  } catch (error) {
    console.error('Failed to fetch financial alerts:', error)
    return []
  }
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