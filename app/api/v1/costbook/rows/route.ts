/**
 * Costbook rows API – Cost Book columns per project
 * Aggregates projects, commitments, actuals; returns pending/approved budget,
 * control estimate, open committed, invoice value, remaining commitment,
 * VOWD, accruals, ETC, EAC, delta EAC, variance.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const OPEN_PO_STATUSES = new Set(['draft', 'approved', 'issued', 'partially_received'])

function num(v: unknown): number {
  if (v == null) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server configuration error', rows: [], count: 0 },
        { status: 503 }
      )
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, name, budget, start_date, end_date, currency')
      .order('updated_at', { ascending: false })

    if (projErr) {
      return NextResponse.json(
        { error: projErr.message, rows: [], count: 0 },
        { status: 400 }
      )
    }
    if (!projects?.length) {
      return NextResponse.json({ rows: [], count: 0 })
    }

    const projectIds = projects.map((p) => String(p.id))

    const [commitmentsRes, actualsRes] = await Promise.all([
      supabase.from('commitments').select('*').in('project_id', projectIds),
      supabase.from('actuals').select('*').in('project_id', projectIds)
    ])
    const commitments = commitmentsRes.data ?? []
    const actuals = actualsRes.data ?? []

    const byProject = <T extends { project_id?: string }>(arr: T[]) => {
      const map: Record<string, T[]> = {}
      for (const x of arr) {
        const pid = String(x.project_id ?? '')
        if (!map[pid]) map[pid] = []
        map[pid].push(x)
      }
      return map
    }
    const commitmentsByProject = byProject(commitments)
    const actualsByProject = byProject(actuals)

    const rows = projects.map((p) => {
      const pid = String(p.id)
      const budget = num(p.budget)
      const projectCommitments = commitmentsByProject[pid] ?? []
      const projectActuals = actualsByProject[pid] ?? []

      const openCommitted = projectCommitments
        .filter((c) => OPEN_PO_STATUSES.has((c.po_status ?? '').toLowerCase()))
        .reduce((s, c) => s + num(c.total_amount ?? c.amount), 0)
      const invoiceValue = projectActuals.reduce((s, a) => s + num(a.amount), 0)
      const remainingCommitment = Math.max(0, openCommitted - invoiceValue)
      const vowd = invoiceValue
      const accruals = 0
      const etc = Math.max(0, budget - invoiceValue)
      const eac = invoiceValue + etc
      const deltaEac = eac - budget
      const variance = budget - eac

      return {
        project_id: pid,
        project_name: p.name ?? '',
        start_date: p.start_date ?? '',
        end_date: p.end_date ?? '',
        pending_budget: 0,
        approved_budget: budget,
        control_estimate: budget,
        open_committed: Math.round(openCommitted * 100) / 100,
        invoice_value: Math.round(invoiceValue * 100) / 100,
        remaining_commitment: Math.round(remainingCommitment * 100) / 100,
        vowd: Math.round(vowd * 100) / 100,
        accruals: Math.round(accruals * 100) / 100,
        etc: Math.round(etc * 100) / 100,
        eac: Math.round(eac * 100) / 100,
        delta_eac: Math.round(deltaEac * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        currency: p.currency ?? 'USD'
      }
    })

    return NextResponse.json({ rows, count: rows.length })
  } catch (e) {
    return NextResponse.json(
      { error: String(e), rows: [], count: 0 },
      { status: 500 }
    )
  }
}
