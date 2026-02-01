'use client'

// AI-Powered Import Builder for Costbook (Task 42)
// Multi-step wizard: Upload → Map → Preview → Import

import React, { useState } from 'react'
import { Upload, Map, Eye, Check } from 'lucide-react'
import { detectColumnMapping, ColumnSuggestion } from '@/lib/costbook/ai-import-mapper'

export interface AIImportBuilderProps {
  onImport?: (mapping: Record<string, string>) => void
  onClose?: () => void
  className?: string
}

const STEPS = ['Upload', 'Map', 'Preview', 'Import'] as const

export function AIImportBuilder({ onImport, onClose, className = '' }: AIImportBuilderProps) {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<ColumnSuggestion[]>([])
  const [schema, setSchema] = useState<'commitment' | 'actual'>('commitment')

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const text = await f.text()
    const firstLine = text.split('\n')[0] ?? ''
    const h = firstLine.split(',').map(s => s.trim())
    setHeaders(h)
    const sug = detectColumnMapping(h, schema)
    setSuggestions(sug)
    setStep(1)
  }

  const mapping = Object.fromEntries(suggestions.map(s => [s.csvHeader, s.suggestedSchemaColumn]))

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 max-w-xl ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Import Builder</h2>
      <div className="flex gap-2 mb-6">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`px-3 py-1 rounded text-sm ${step === i ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            {s}
          </button>
        ))}
      </div>
      {step === 0 && (
        <div>
          <label className="block text-sm text-gray-600 mb-2">Select CSV file</label>
          <input type="file" accept=".csv" onChange={handleFileSelect} className="block w-full text-sm" />
        </div>
      )}
      {step === 1 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Suggested mapping (confidence)</p>
          {suggestions.map((s) => (
            <div key={s.csvHeader} className="flex justify-between text-sm">
              <span className="text-gray-700">{s.csvHeader}</span>
              <span className="text-gray-500">{s.suggestedSchemaColumn} ({(s.confidence * 100).toFixed(0)}%)</span>
            </div>
          ))}
          <button type="button" onClick={() => setStep(2)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Next: Preview
          </button>
        </div>
      )}
      {step === 2 && (
        <div>
          <p className="text-sm text-gray-600 mb-2">Preview mapping and import.</p>
          <button type="button" onClick={() => { setStep(3); onImport?.(mapping); }} className="px-4 py-2 bg-blue-600 text-white rounded">
            Import
          </button>
        </div>
      )}
      {step === 3 && (
        <div className="text-green-600">Import complete.</div>
      )}
      {onClose && (
        <button type="button" onClick={onClose} className="mt-4 text-sm text-gray-500">
          Close
        </button>
      )}
    </div>
  )
}
