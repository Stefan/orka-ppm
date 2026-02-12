'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  ChevronRight, ChevronDown, Upload, Plus, Edit2, Trash2, 
  Download, RefreshCw, Search, Filter, AlertCircle, CheckCircle
} from 'lucide-react'
import { POBreakdown, POBreakdownSummary, POImportResult } from '../../types'
import { getApiUrl } from '../../../../lib/api'
import { logger } from '@/lib/monitoring/logger'
import { debugIngest } from '@/lib/debug-ingest'

interface POBreakdownViewProps {
  accessToken?: string
  projectId?: string
}

export default function POBreakdownView({ accessToken, projectId }: POBreakdownViewProps) {
  const [breakdowns, setBreakdowns] = useState<POBreakdown[]>([])
  const [summary, setSummary] = useState<POBreakdownSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [importResult, setImportResult] = useState<POImportResult | null>(null)
  const toolbarRowRef = useRef<HTMLDivElement>(null)

  // #region agent log
  useEffect(() => {
    const el = toolbarRowRef.current
    if (!el) return
    const log = () => {
      const cw = el.clientWidth
      const sw = el.scrollWidth
      const main = document.querySelector('[data-testid="app-layout-main"]')
      debugIngest({ location: 'POBreakdownView.tsx:toolbar', message: 'toolbar_metrics', data: { toolbarClientWidth: cw, toolbarScrollWidth: sw, overflow: sw > cw, mainClientWidth: main?.clientWidth }, hypothesisId: 'H2' })
    }
    log()
    const ro = new ResizeObserver(log)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // #endregion

  useEffect(() => {
    if (!projectId) return
    const t = setTimeout(() => {
      fetchBreakdowns()
      fetchSummary()
    }, 100)
    return () => clearTimeout(t)
  }, [projectId])

  const fetchBreakdowns = async () => {
    if (!projectId || !accessToken) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(
        getApiUrl(`/pos/breakdown/projects/${projectId}/po-breakdowns`),
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (!response.ok) {
        // Don't throw, just set error message
        setError('PO Breakdown is not configured yet.')
        setLoading(false)
        return
      }
      
      const data = await response.json()
      setBreakdowns(buildHierarchy(data))
    } catch (err) {
      logger.error('PO Breakdown fetch error', { err }, 'POBreakdownView')
      setError('PO Breakdown is not configured yet.')
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    if (!projectId || !accessToken) return
    
    try {
      const response = await fetch(
        getApiUrl(`/pos/breakdown/projects/${projectId}/summary`),
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (response.ok) {
        const data = await response.json()
        setSummary(data)
      }
    } catch (err) {
      logger.error('Failed to fetch summary', { err }, 'POBreakdownView')
    }
  }

  const buildHierarchy = (flatList: POBreakdown[]): POBreakdown[] => {
    const map = new Map<string, POBreakdown>()
    const roots: POBreakdown[] = []
    
    // First pass: create map
    flatList.forEach(item => {
      map.set(item.id, { ...item, children: [] })
    })
    
    // Second pass: build hierarchy
    flatList.forEach(item => {
      const node = map.get(item.id)!
      if (item.parent_breakdown_id) {
        const parent = map.get(item.parent_breakdown_id)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(node)
        } else {
          roots.push(node)
        }
      } else {
        roots.push(node)
      }
    })
    
    return roots
  }

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const handleFileUpload = async (file: File) => {
    if (!projectId || !accessToken) return
    
    setUploadProgress(0)
    setImportResult(null)
    
    const formData = new FormData()
    formData.append('file', file)
    formData.append('project_id', projectId)
    formData.append('column_mappings', JSON.stringify({
      'Name': 'name',
      'SAP PO': 'sap_po_number',
      'Planned Amount': 'planned_amount',
      'Cost Center': 'cost_center'
    }))
    
    try {
      const response = await fetch(
        getApiUrl('/pos/breakdown/import'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          body: formData
        }
      )
      
      if (!response.ok) {
        throw new Error('Import failed')
      }
      
      const result = await response.json()
      setImportResult(result)
      setUploadProgress(100)
      
      // Refresh data
      await fetchBreakdowns()
      await fetchSummary()
      
      // Close modal after 3 seconds if successful
      if (result.success) {
        setTimeout(() => {
          setShowUploadModal(false)
          setImportResult(null)
        }, 3000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const renderBreakdownNode = (node: POBreakdown, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const indent = level * 24
    
    const utilizationPercent = node.planned_amount > 0 
      ? (node.actual_amount / node.planned_amount) * 100 
      : 0
    
    return (
      <div key={node.id} className="border-b border-gray-100 dark:border-slate-700 last:border-b-0">
        <div 
          className="flex items-center py-3 px-4 hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 cursor-pointer"
          style={{ paddingLeft: `${indent + 16}px` }}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={() => toggleNode(node.id)}
            className="mr-2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          
          {/* Name and Code */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-900 dark:text-slate-100 truncate">{node.name}</span>
              {node.code && (
                <span className="text-xs text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                  {node.code}
                </span>
              )}
              {node.sap_po_number && (
                <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                  {node.sap_po_number}
                </span>
              )}
            </div>
            {node.cost_center && (
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Cost Center: {node.cost_center}
              </div>
            )}
          </div>
          
          {/* Amounts */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-right">
              <div className="text-gray-600 dark:text-slate-400">Planned</div>
              <div className="font-medium text-gray-900 dark:text-slate-100">
                {node.planned_amount.toLocaleString()} {node.currency}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-gray-600 dark:text-slate-400">Committed</div>
              <div className="font-medium text-blue-600 dark:text-blue-400">
                {node.committed_amount.toLocaleString()} {node.currency}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-gray-600 dark:text-slate-400">Actual</div>
              <div className="font-medium text-green-600 dark:text-green-400">
                {node.actual_amount.toLocaleString()} {node.currency}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-gray-600 dark:text-slate-400">Remaining</div>
              <div className="font-medium text-gray-900 dark:text-slate-100">
                {node.remaining_amount.toLocaleString()} {node.currency}
              </div>
            </div>
            
            {/* Utilization Bar */}
            <div className="w-24">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400 mb-1">
                <span>Utilization</span>
                <span>{utilizationPercent.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    utilizationPercent > 90 ? 'bg-red-500' : 
                    utilizationPercent > 75 ? 'bg-yellow-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            <button className="p-1 text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400">
              <Edit2 className="h-4 w-4" />
            </button>
            <button className="p-1 text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Children */}
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderBreakdownNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-3" />
          <div>
            <h3 className="font-medium text-yellow-900 dark:text-yellow-300">No Project Selected</h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Please select a project to view PO breakdowns
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards-grid min-w-0">
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-0.5 sm:mb-1 truncate">Total Planned</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
              {summary.total_planned.toLocaleString()} {summary.currency}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-0.5 sm:mb-1 truncate">Total Committed</div>
            <div className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
              {summary.total_committed.toLocaleString()} {summary.currency}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-0.5 sm:mb-1 truncate">Total Actual</div>
            <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">
              {summary.total_actual.toLocaleString()} {summary.currency}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-400 mb-0.5 sm:mb-1 truncate">Remaining</div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
              {summary.total_remaining.toLocaleString()} {summary.currency}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-500 mt-1 truncate">
              {summary.breakdown_count} items, {summary.hierarchy_levels} levels
            </div>
          </div>
        </div>
      )}
      
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 min-w-0">
        <div ref={toolbarRowRef} className="flex items-center justify-between flex-wrap gap-2 overflow-x-auto min-w-0">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search breakdowns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
              />
            </div>
            
            <button className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 flex items-center space-x-2 text-gray-700 dark:text-slate-300">
              <Filter className="h-4 w-4" />
              <span>Filter</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={fetchBreakdowns}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 flex items-center space-x-2 text-gray-700 dark:text-slate-300"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            
            <button className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 flex items-center space-x-2 text-gray-700 dark:text-slate-300">
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
            
            <button 
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Import CSV</span>
            </button>
            
            <button className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-700 flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Breakdown</span>
            </button>
          </div>
        </div>
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
            <div>
              <h3 className="font-medium text-red-900 dark:text-red-300">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Breakdown Tree */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-slate-700 px-4 py-3 border-b border-gray-200 dark:border-slate-600">
          <div className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-slate-300">
            <div className="flex-1">PO Breakdown Structure</div>
            <div className="flex items-center space-x-6">
              <div>Planned</div>
              <div>Committed</div>
              <div>Actual</div>
              <div>Remaining</div>
              <div className="w-24">Utilization</div>
              <div className="w-16">Actions</div>
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : breakdowns.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-slate-400 mb-4">
              <p className="text-lg font-medium">No PO breakdowns found</p>
              <p className="text-sm mt-2">Select a project to view its PO breakdown.</p>
            </div>
            <div className="mt-6 space-y-2 text-sm text-gray-600 dark:text-slate-400">
              <p>To get started:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Import a CSV file with PO breakdown structure</li>
                <li>Or create a breakdown manually using the "Add Breakdown" button</li>
              </ul>
            </div>
            <div className="mt-6">
              <button 
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center space-x-2"
              >
                <Upload className="h-5 w-5" />
                <span>Import CSV File</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {breakdowns.map(node => renderBreakdownNode(node))}
          </div>
        )}
      </div>
      
      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-slate-100">Import PO Breakdown CSV</h3>
            
            {!importResult ? (
              <div>
                <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                    Drag and drop your CSV file here, or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                    }}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer inline-block"
                  >
                    Select File
                  </label>
                </div>
                
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-400 mb-2">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {importResult.success ? (
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 text-green-500 dark:text-green-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Import Successful!</h4>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
                      {importResult.successful_imports} of {importResult.total_rows} records imported
                    </p>
                    {importResult.warnings.length > 0 && (
                      <div className="text-left bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-3 mb-4">
                        <p className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-1">Warnings:</p>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
                          {importResult.warnings.slice(0, 3).map((warning, i) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <AlertCircle className="h-16 w-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Import Failed</h4>
                    <div className="text-left bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded p-3 mb-4">
                      <p className="text-sm font-medium text-red-900 dark:text-red-300 mb-1">Errors:</p>
                      <ul className="text-xs text-red-700 dark:text-red-400 space-y-1">
                        {importResult.errors.slice(0, 5).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setImportResult(null)
                  setUploadProgress(0)
                }}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:bg-slate-800/50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
