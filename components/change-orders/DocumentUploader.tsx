'use client'

import { useState } from 'react'
import { Upload, FileText } from 'lucide-react'

interface DocumentUploaderProps {
  changeOrderId: string
  onUploadComplete?: () => void
}

export default function DocumentUploader({ changeOrderId, onUploadComplete }: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      // Document upload would call backend API - placeholder for UI
      setMessage(`Selected: ${file.name}. Document upload API integration pending.`)
      onUploadComplete?.()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-6 text-center">
      <input
        type="file"
        id="doc-upload"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        onChange={handleFileSelect}
        disabled={uploading}
      />
      <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-2">
        <Upload className="w-10 h-10 text-gray-400" />
        <span className="text-sm text-gray-600">
          {uploading ? 'Uploading...' : 'Click to upload drawings, specs, calculations'}
        </span>
        <span className="text-xs text-gray-400">PDF, DOC, XLS, images</span>
      </label>
      {message && (
        <p className="mt-2 text-sm text-amber-600">{message}</p>
      )}
    </div>
  )
}
