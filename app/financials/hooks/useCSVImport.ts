import { useState, useCallback } from 'react'
import { CSVImportHistory, CSVUploadResult } from '../types'
import { fetchCSVImportHistory, uploadCSVFile, downloadCSVTemplate } from '../utils/api'

interface UseCSVImportProps {
  accessToken: string | undefined
}

export function useCSVImport({ accessToken }: UseCSVImportProps) {
  const [csvImportHistory, setCsvImportHistory] = useState<CSVImportHistory[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadResult, setUploadResult] = useState<CSVUploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!accessToken) return
    
    try {
      const history = await fetchCSVImportHistory(accessToken)
      setCsvImportHistory(history)
    } catch (error) {
      console.error('Failed to fetch CSV import history:', error)
    }
  }, [accessToken])

  const handleFileUpload = useCallback(async (
    file: File, 
    importType: 'commitments' | 'actuals'
  ) => {
    if (!accessToken) return
    
    setUploadingFile(true)
    setUploadResult(null)
    
    try {
      const result = await uploadCSVFile(file, importType, accessToken)
      setUploadResult(result)
      
      // Refresh history after upload
      await fetchHistory()
    } catch (error) {
      setUploadResult({
        success: false,
        records_processed: 0,
        records_imported: 0,
        errors: [{ 
          row: 0, 
          field: 'file', 
          message: error instanceof Error ? error.message : 'Upload failed' 
        }],
        warnings: [],
        import_id: ''
      })
    } finally {
      setUploadingFile(false)
    }
  }, [accessToken, fetchHistory])

  const handleDownloadTemplate = useCallback(async (
    importType: 'commitments' | 'actuals'
  ) => {
    if (!accessToken) return
    
    try {
      await downloadCSVTemplate(importType, accessToken)
    } catch (error) {
      console.error('Failed to download template:', error)
    }
  }, [accessToken])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [])

  const handleDrop = useCallback((
    e: React.DragEvent, 
    importType: 'commitments' | 'actuals'
  ) => {
    e.preventDefault()
    setDragActive(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file && file.name.toLowerCase().endsWith('.csv')) {
        handleFileUpload(file, importType)
      } else {
        alert('Bitte wählen Sie eine CSV-Datei aus.')
      }
    }
  }, [handleFileUpload])

  return {
    csvImportHistory,
    uploadingFile,
    uploadResult,
    dragActive,
    fetchHistory,
    handleFileUpload,
    handleDownloadTemplate,
    handleDragOver,
    handleDragLeave,
    handleDrop
  }
}