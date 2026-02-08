'use client'

import React, { useRef, useState, useCallback } from 'react'
import { useAuth } from '@/app/providers/SupabaseAuthProvider'
import AppLayout from '@/components/shared/AppLayout'
import { getApiUrl } from '@/lib/api'
import { WorkflowCanvas, type WorkflowCanvasRef, type StepNodeData, nodesAndEdgesToSteps } from './WorkflowCanvas'
import { CheckSquare, Bell, GitBranch } from 'lucide-react'

export default function WorkflowBuilderPage() {
  const { session } = useAuth()
  const canvasRef = useRef<WorkflowCanvasRef>(null)
  const [workflowName, setWorkflowName] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [, forceUpdate] = useState(0)
  const refreshSelection = useCallback(() => forceUpdate((n) => n + 1), [])

  const selectedNode: StepNodeData | null =
    selectedNodeId && canvasRef.current
      ? canvasRef.current.getNodes().find((n) => n.id === selectedNodeId)?.data ?? null
      : null

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas || !session?.access_token) {
      setSaveStatus('error')
      setSaveMessage('Not authenticated or canvas not ready.')
      return
    }
    const nodes = canvas.getNodes()
    const edges = canvas.getEdges()
    const steps = nodesAndEdgesToSteps(nodes, edges)
    if (steps.length === 0) {
      setSaveStatus('error')
      setSaveMessage('Add at least one step to the canvas.')
      return
    }
    const stepIds = new Set(nodes.filter((n) => n.type === 'step').map((n) => n.id))
    const connectedIds = new Set<string>()
    edges.forEach((e) => {
      if (stepIds.has(e.source)) connectedIds.add(e.source)
      if (stepIds.has(e.target)) connectedIds.add(e.target)
    })
    const isolated = stepIds.size > 1 && [...stepIds].some((id) => !connectedIds.has(id))
    if (isolated) {
      setSaveStatus('error')
      setSaveMessage('Some steps are not connected. Connect all steps with edges or remove unused steps.')
      return
    }
    const name = workflowName.trim() || 'Workflow from builder'
    setSaveStatus('saving')
    setSaveMessage('')
    try {
      const body = {
        name,
        description: `Created in Workflow Builder`,
        steps: steps.map((s) => ({
          step_order: s.step_order,
          step_type: s.step_type,
          name: s.name,
          approvers: [],
          approver_roles: [],
          approval_type: 'all',
          ...(s.timeout_hours != null && s.timeout_hours >= 1 && { timeout_hours: s.timeout_hours }),
          ...(s.conditions != null && Object.keys(s.conditions).length > 0 && { conditions: s.conditions }),
        })),
        triggers: [],
        status: 'draft',
      }
      const res = await fetch(getApiUrl('/workflows'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text()
        setSaveStatus('error')
        setSaveMessage(text || res.statusText)
        return
      }
      setSaveStatus('success')
      setSaveMessage('Workflow saved as draft.')
    } catch (e) {
      setSaveStatus('error')
      setSaveMessage(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Workflow Builder
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Drag steps and connect them with edges. Save to create a draft workflow.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Workflow name
          </label>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="e.g. Budget Approval"
            className="w-full max-w-md rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex gap-4 mb-4">
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 min-w-[180px]">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
              Add step
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  canvasRef.current?.addNode({
                    label: 'Approval',
                    stepType: 'approval',
                  })
                  refreshSelection()
                }}
                className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <CheckSquare className="h-4 w-4 text-slate-500" />
                Approval
              </button>
              <button
                type="button"
                onClick={() => {
                  canvasRef.current?.addNode({
                    label: 'Notification',
                    stepType: 'notification',
                  })
                  refreshSelection()
                }}
                className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Bell className="h-4 w-4 text-slate-500" />
                Notification
              </button>
              <button
                type="button"
                onClick={() => {
                  canvasRef.current?.addNode({
                    label: 'Condition',
                    stepType: 'condition',
                  })
                  refreshSelection()
                }}
                className="flex items-center gap-2 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <GitBranch className="h-4 w-4 text-slate-500" />
                Condition
              </button>
            </div>
          </div>
          <div className="flex-1">
            <WorkflowCanvas
              ref={canvasRef}
              onNodeSelect={(id) => {
                setSelectedNodeId(id)
                refreshSelection()
              }}
            />
          </div>
          {selectedNode && selectedNodeId && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 min-w-[200px]">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-2">
                Properties
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-slate-700 dark:text-slate-300">Label</label>
                <input
                  type="text"
                  value={selectedNode.label}
                  onChange={(e) => {
                    canvasRef.current?.setNodeData(selectedNodeId, {
                      label: e.target.value,
                    })
                    refreshSelection()
                  }}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
                />
                <label className="block text-sm text-slate-700 dark:text-slate-300">Type</label>
                <select
                  value={selectedNode.stepType}
                  onChange={(e) => {
                    const stepType = e.target.value as StepNodeData['stepType']
                    canvasRef.current?.setNodeData(selectedNodeId, { stepType })
                    refreshSelection()
                  }}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="approval">Approval</option>
                  <option value="notification">Notification</option>
                  <option value="condition">Condition</option>
                </select>
                <label className="block text-sm text-slate-700 dark:text-slate-300">Timeout (hours)</label>
                <input
                  type="number"
                  min={1}
                  placeholder="Optional"
                  value={selectedNode.timeout_hours ?? ''}
                  onChange={(e) => {
                    const v = e.target.value.trim()
                    canvasRef.current?.setNodeData(selectedNodeId, {
                      timeout_hours: v === '' ? null : Math.max(1, parseInt(v, 10) || 1),
                    })
                    refreshSelection()
                  }}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
                />
                <label className="block text-sm text-slate-700 dark:text-slate-300">Conditions (JSON)</label>
                <textarea
                  rows={2}
                  placeholder='e.g. {"threshold": 100}'
                  value={selectedNode.conditions ?? ''}
                  onChange={(e) => {
                    canvasRef.current?.setNodeData(selectedNodeId, {
                      conditions: e.target.value.trim() || null,
                    })
                    refreshSelection()
                  }}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="rounded bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-4 py-2 font-medium disabled:opacity-50"
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save as draft'}
          </button>
          {saveStatus === 'success' && (
            <span className="text-green-600 dark:text-green-400">{saveMessage}</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-600 dark:text-red-400">{saveMessage}</span>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
