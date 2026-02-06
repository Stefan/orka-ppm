'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import AppLayout from '../../../components/shared/AppLayout'
import { Upload } from 'lucide-react'

// Lazy load Import-Form mit Papa Parse und XLSX
const LazyImportForm = dynamic(
  () => import('../components/ImportForm'),
  {
    ssr: false, // Wichtig: Papa Parse funktioniert nur client-side
    loading: () => (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }
)

export default function ProjectImportPage() {
  const [showImportForm, setShowImportForm] = useState(false)

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Import Projects</h1>

          {!showImportForm ? (
            // Landing Page - kein Papa Parse geladen
            <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-sm text-center">
              <Upload className="h-16 w-16 mx-auto text-blue-600 dark:text-blue-400 mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Import Projects from CSV or Excel
              </h2>
              <p className="text-gray-600 dark:text-slate-400 mb-6">
                Upload your project data and map columns to fields
              </p>
              <button
                onClick={() => setShowImportForm(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start Import
              </button>
            </div>
          ) : (
            // Import Form - Papa Parse wird erst hier geladen
            <LazyImportForm />
          )}
        </div>
      </div>
    </AppLayout>
  )
}
