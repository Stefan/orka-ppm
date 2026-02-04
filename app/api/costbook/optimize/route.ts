import { NextRequest, NextResponse } from 'next/server'

export interface CostbookOptimizeSuggestion {
  id: string
  description: string
  metric: string
  change: number
  unit: string
  impact: string
  projectId?: string
}

/**
 * POST /api/costbook/optimize
 * Returns AI/rule-based optimization suggestions for the costbook (ETC, Accruals, Distribution).
 * Body can include projectIds or current snapshot; for now returns mock suggestions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const _projectIds = body.projectIds as string[] | undefined

    // Mock suggestions; in production this would call backend optimizer or EAC/ETC logic
    const suggestions: CostbookOptimizeSuggestion[] = [
      {
        id: 'opt-1',
        description: 'Reduce ETC by 5% on over-budget projects to align with trend',
        metric: 'ETC',
        change: -0.05,
        unit: '%',
        impact: 'Lowers EAC and improves variance visibility.',
      },
      {
        id: 'opt-2',
        description: 'Adjust next-period accruals to match actual spend rate',
        metric: 'Accruals',
        change: 0,
        unit: '—',
        impact: 'Smooths forecast and reduces month-end surprises.',
      },
      {
        id: 'opt-3',
        description: 'Apply linear distribution to projects without custom profile',
        metric: 'Distribution',
        change: 0,
        unit: '—',
        impact: 'Consistent cash flow forecast across portfolio.',
      },
    ]

    return NextResponse.json({ suggestions })
  } catch (e) {
    console.error('Costbook optimize error:', e)
    return NextResponse.json(
      { error: 'Optimization failed', suggestions: [] },
      { status: 500 }
    )
  }
}
