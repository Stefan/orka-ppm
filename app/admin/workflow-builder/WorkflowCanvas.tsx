'use client'

import React, { useCallback, useRef, useImperativeHandle, forwardRef } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export type StepNodeData = {
  label: string
  stepType: 'approval' | 'notification' | 'condition'
  stepOrder?: number
  /** Timeout in hours for step completion (optional). */
  timeout_hours?: number | null
  /** Conditions for step execution (JSON object); stored as string in UI. */
  conditions?: string | null
}

const stepNodeTypes: NodeTypes = {
  step: ({ data }: { data: StepNodeData }) => (
    <div className="px-3 py-2 rounded-lg border-2 border-slate-400 bg-white dark:bg-slate-800 shadow min-w-[140px]">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase">{data.stepType}</div>
      <div className="font-medium text-slate-900 dark:text-slate-100">{data.label || 'Step'}</div>
      {data.timeout_hours != null && data.timeout_hours > 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{data.timeout_hours}h timeout</div>
      )}
    </div>
  ),
}

const initialNodes: Node<StepNodeData>[] = [
  {
    id: '1',
    type: 'step',
    position: { x: 100, y: 100 },
    data: { label: 'Start / Approval', stepType: 'approval', stepOrder: 0 },
  },
]
const initialEdges: Edge[] = []

export type WorkflowCanvasRef = {
  getNodes: () => Node<StepNodeData>[]
  getEdges: () => Edge[]
  setNodeData: (nodeId: string, data: Partial<StepNodeData>) => void
  addNode: (data: StepNodeData) => void
}

function nextId(nodes: Node<StepNodeData>[]): string {
  const ids = new Set(nodes.map((n) => n.id))
  let i = 1
  while (ids.has(String(i))) i++
  return String(i)
}

export const WorkflowCanvas = forwardRef<
  WorkflowCanvasRef,
  { readOnly?: boolean; onNodeSelect?: (nodeId: string | null) => void }
>(function WorkflowCanvas({ readOnly = false, onNodeSelect }, ref) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StepNodeData>>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  useImperativeHandle(ref, () => ({
    getNodes: () => nodesRef.current,
    getEdges: () => edgesRef.current,
    setNodeData: (nodeId: string, data: Partial<StepNodeData>) => {
      setNodes((nds: Node<StepNodeData>[]) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n
        )
      )
    },
    addNode: (data: StepNodeData) => {
      const id = nextId(nodesRef.current)
      const last = nodesRef.current[nodesRef.current.length - 1]
      const position = last
        ? { x: last.position.x + 180, y: last.position.y }
        : { x: 100, y: 100 }
      setNodes((nds: Node<StepNodeData>[]) => [
        ...nds,
        { id, type: 'step', position, data: { ...data } },
      ])
    },
  }))

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<StepNodeData>) => {
      onNodeSelect?.(node.id)
    },
    [onNodeSelect]
  )
  const onPaneClick = useCallback(() => {
    onNodeSelect?.(null)
  }, [onNodeSelect])

  return (
    <div className="w-full h-[400px] rounded-lg border border-slate-200 dark:border-slate-700">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={stepNodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  )
})

export type StepPayload = {
  step_order: number
  step_type: string
  name: string
  timeout_hours?: number | null
  conditions?: Record<string, unknown> | null
}

/** Build backend WorkflowDefinition steps from canvas nodes (topological order by edges, fallback node order). */
export function nodesAndEdgesToSteps(
  nodes: Node<StepNodeData>[],
  edges: Edge[]
): StepPayload[] {
  const stepNodes = nodes.filter((n) => n.type === 'step') as Node<StepNodeData>[]
  if (stepNodes.length === 0) return []
  const orderById = new Map<string, number>()
  const inDegree = new Map<string, number>()
  stepNodes.forEach((n) => {
    inDegree.set(n.id, 0)
  })
  edges.forEach((e) => {
    if (inDegree.has(e.target)) inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  })
  const queue = stepNodes.filter((n) => inDegree.get(n.id) === 0).map((n) => n.id)
  let stepOrder = 0
  while (queue.length > 0) {
    const id = queue.shift()!
    orderById.set(id, stepOrder++)
    edges.forEach((e) => {
      if (e.source === id && inDegree.has(e.target)) {
        const d = inDegree.get(e.target)! - 1
        inDegree.set(e.target, d)
        if (d === 0) queue.push(e.target)
      }
    })
  }
  stepNodes.forEach((n) => {
    if (!orderById.has(n.id)) orderById.set(n.id, stepOrder++)
  })
  return stepNodes
    .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0))
    .map((n, i) => {
      let conditions: Record<string, unknown> | null = null
      if (n.data.conditions != null && String(n.data.conditions).trim()) {
        try {
          conditions = JSON.parse(n.data.conditions) as Record<string, unknown>
        } catch {
          conditions = { expression: n.data.conditions }
        }
      }
      return {
        step_order: i,
        step_type: n.data.stepType ?? 'approval',
        name: n.data.label || `Step ${i + 1}`,
        timeout_hours: n.data.timeout_hours != null && n.data.timeout_hours >= 1 ? n.data.timeout_hours : undefined,
        conditions: conditions ?? undefined,
      }
    })
}
