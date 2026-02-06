'use client'

/**
 * Phase 2 – Integration & Customizability: No-Code Workflow Builder
 * Enterprise Readiness: react-flow based workflow editor
 */

import React, { useCallback } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { WorkflowNode as WorkflowNodeType, WorkflowEdge as WorkflowEdgeType } from '@/types/enterprise'

const defaultNodeTypes: NodeTypes = {}
const defaultEdgeTypes: EdgeTypes = {}

export interface WorkflowBuilderProps {
  initialNodes?: Node[]
  initialEdges?: Edge[]
  onSave?: (nodes: Node[], edges: Edge[]) => void
  readOnly?: boolean
  className?: string
}

const defaultNodes: Node[] = [
  { id: 'start', type: 'input', position: { x: 100, y: 50 }, data: { label: 'Start' } },
  { id: 'step1', type: 'default', position: { x: 100, y: 150 }, data: { label: 'Schritt 1' } },
  { id: 'end', type: 'output', position: { x: 100, y: 250 }, data: { label: 'Ende' } },
]
const defaultEdges: Edge[] = [
  { id: 'e-start-1', source: 'start', target: 'step1' },
  { id: 'e-1-end', source: 'step1', target: 'end' },
]

export function WorkflowBuilder({
  initialNodes = defaultNodes,
  initialEdges = defaultEdges,
  onSave,
  readOnly = false,
  className = '',
}: WorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onSaveClick = useCallback(() => {
    onSave?.(nodes, edges)
  }, [nodes, edges, onSave])

  return (
    <div className={`h-[400px] w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        nodeTypes={defaultNodeTypes}
        edgeTypes={defaultEdgeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
      >
        <Background />
        <Controls />
      </ReactFlow>
      {!readOnly && onSave && (
        <div className="absolute bottom-4 right-4">
          <button
            type="button"
            onClick={onSaveClick}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            Workflow speichern
          </button>
        </div>
      )}
    </div>
  )
}

export default WorkflowBuilder
