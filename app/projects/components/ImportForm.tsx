'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useAuth } from '../../providers/SupabaseAuthProvider'
import { getApiUrl } from '../../../lib/api/client'

interface ImportFormProps {
  onComplete?: () => void
}

export default function ImportForm({ onComplete }: ImportFormProps) {
  const { session } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)

  // File drop handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      // Parse CSV mit Papa Parse
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          setHeaders(Object.keys(results.data[0] || {}))
          setData(results.data)
        },
        error: (error) => {
          console.error('CSV Parse Error:', error)
        }
      })
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      // Parse Excel mit XLSX
      const reader = new FileReader()
      reader.onload = (e) => {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        setHeaders(Object.keys(jsonData[0] || {}))
        setData(jsonData)
      }
      reader.readAsBinaryString(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1
  })

  // Upload zu Backend
  const handleUpload = async () => {
    if (!session?.access_token) return

    setUploading(true)
    try {
      const response = await fetch(getApiUrl('/csv-import'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data,
          mapping
        })
      })

      if (!response.ok) throw new Error('Upload failed')

      onComplete?.()
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-slate-600 hover:border-gray-400'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-600 dark:text-slate-400">
          {isDragActive
            ? 'Drop file here...'
            : 'Drag & drop CSV or Excel file, or click to select'}
        </p>
      </div>

      {/* Preview und Mapping */}
      {data.length > 0 && (
        <>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-4">
              Column Mapping ({data.length} rows)
            </h3>
            <div className="space-y-3">
              {headers.map(header => (
                <div key={header} className="flex items-center gap-4">
                  <span className="w-1/3 font-medium">{header}</span>
                  <select
                    value={mapping[header] || ''}
                    onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                    className="flex-1 p-2 border rounded"
                  >
                    <option value="">Skip</option>
                    <option value="name">Project Name</option>
                    <option value="budget">Budget</option>
                    <option value="start_date">Start Date</option>
                    <option value="end_date">End Date</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Import Projects'}
          </button>
        </>
      )}
    </div>
  )
}
