/**
 * ConflictResolutionModal Component
 * 
 * Modal interface for resolving editing conflicts between multiple users
 */

'use client'

import React, { useState } from 'react'
import { X, AlertTriangle, CheckCircle, Users, Clock } from 'lucide-react'
import type { Conflict } from './types'

export interface ConflictResolutionModalProps {
  conflict: Conflict
  isOpen: boolean
  onClose: () => void
  onResolve: (conflictId: string, resolution: 'merge' | 'overwrite' | 'manual', selectedContent?: any) => void
}

export default function ConflictResolutionModal({
  conflict,
  isOpen,
  onClose,
  onResolve
}: ConflictResolutionModalProps) {
  const [selectedChangeIndex, setSelectedChangeIndex] = useState<number | null>(null)
  const [resolutionStrategy, setResolutionStrategy] = useState<'merge' | 'overwrite' | 'manual'>('overwrite')

  if (!isOpen) return null

  const handleResolve = () => {
    if (resolutionStrategy === 'overwrite' && selectedChangeIndex !== null) {
      const selectedChange = conflict.conflicting_changes[selectedChangeIndex]
      onResolve(conflict.id, resolutionStrategy, selectedChange.content)
    } else {
      onResolve(conflict.id, resolutionStrategy)
    }
    onClose()
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Resolve Editing Conflict
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Section: {conflict.section_id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Conflict Info */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">
                  {conflict.conflict_type === 'simultaneous_edit' && 'Multiple users edited this section simultaneously'}
                  {conflict.conflict_type === 'version_mismatch' && 'Version mismatch detected'}
                  {conflict.conflict_type === 'permission_conflict' && 'Permission conflict occurred'}
                </p>
                <p className="text-sm text-red-700 mt-1">
                  {conflict.conflicting_users.length} conflicting changes detected
                </p>
              </div>
            </div>
          </div>

          {/* Original Content */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Original Content</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                {JSON.stringify(conflict.original_content, null, 2)}
              </pre>
            </div>
          </div>

          {/* Conflicting Changes */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Conflicting Changes</h3>
            <div className="space-y-3">
              {conflict.conflicting_changes.map((change, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedChangeIndex === index
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedChangeIndex(index)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-900">
                        User: {change.user_id}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimestamp(change.timestamp)}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                      {JSON.stringify(change.content, null, 2)}
                    </pre>
                  </div>
                  {selectedChangeIndex === index && (
                    <div className="mt-2 flex items-center space-x-2 text-sm text-blue-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Selected for resolution</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Resolution Strategy */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Resolution Strategy</h3>
            <div className="space-y-2">
              <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="resolution"
                  value="overwrite"
                  checked={resolutionStrategy === 'overwrite'}
                  onChange={(e) => setResolutionStrategy(e.target.value as any)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Use Selected Change</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Replace the content with the selected change above
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="resolution"
                  value="merge"
                  checked={resolutionStrategy === 'merge'}
                  onChange={(e) => setResolutionStrategy(e.target.value as any)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Merge Changes</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Attempt to automatically merge all changes (may not always be possible)
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="resolution"
                  value="manual"
                  checked={resolutionStrategy === 'manual'}
                  onChange={(e) => setResolutionStrategy(e.target.value as any)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Manual Resolution</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Mark as resolved and edit the section manually
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleResolve}
            disabled={resolutionStrategy === 'overwrite' && selectedChangeIndex === null}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Resolve Conflict
          </button>
        </div>
      </div>
    </div>
  )
}
