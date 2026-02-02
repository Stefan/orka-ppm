/**
 * Phase 2 – Workflow Builder: Save/Load workflow definitions
 * Enterprise Readiness: No-Code workflow persistence (stub)
 */

import { NextRequest, NextResponse } from 'next/server'
import type { WorkflowNode, WorkflowEdge } from '@/types/enterprise'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  return NextResponse.json([])
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { name?: string; nodes?: WorkflowNode[]; edges?: WorkflowEdge[] }
    const { name = 'Untitled', nodes = [], edges = [] } = body

    return NextResponse.json({
      id: `wf_${Date.now()}`,
      name,
      nodes,
      edges,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
