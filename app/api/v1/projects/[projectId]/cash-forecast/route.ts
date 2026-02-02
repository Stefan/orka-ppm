/**
 * Phase 3 – Cash Out Forecast (stub)
 * Enterprise Readiness: Distribution Rules Engine + Gantt
 */

import { NextRequest, NextResponse } from 'next/server'
import type { CashForecastPeriod } from '@/types/enterprise'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const stub: CashForecastPeriod[] = [
      { period: '2024-Q1', planned: 0, actual: 0, forecast: 0 },
      { period: '2024-Q2', planned: 0, actual: 0, forecast: 0 },
      { period: '2024-Q3', planned: 0, actual: 0, forecast: 0 },
      { period: '2024-Q4', planned: 0, actual: 0, forecast: 0 },
    ]

    return NextResponse.json(stub)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
