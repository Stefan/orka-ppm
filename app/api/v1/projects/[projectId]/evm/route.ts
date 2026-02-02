/**
 * Phase 3 – AI, Analytics & Reliability: EVM Metrics (CPI, SPI, TCPI, VAC, CV, SV)
 * Enterprise Readiness: Earned Value Management
 */

import { NextRequest, NextResponse } from 'next/server'
import type { EvmMetrics } from '@/types/enterprise'

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

    // Stub: replace with real EVM calculation from backend or Supabase
    const stub: EvmMetrics = {
      cpi: 1.0,
      spi: 1.0,
      tcpi: 1.0,
      vac: 0,
      cv: 0,
      sv: 0,
      bac: 0,
      eac: 0,
      etc: 0,
    }

    return NextResponse.json(stub)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
