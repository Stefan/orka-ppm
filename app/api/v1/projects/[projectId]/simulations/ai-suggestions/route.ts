/**
 * AI scenario suggestions for Predictive Sim (project-scoped).
 * Returns 3–5 preset scenarios; can be extended to call LLM later.
 * Requirements: R-PS2
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export interface AIScenarioSuggestion {
  id: string
  name: string
  description: string
  params: {
    budget_uncertainty?: number
    schedule_uncertainty?: number
    resource_availability?: number
    iterations?: number
    confidence_level?: number
  }
}

const FALLBACK_PRESETS: AIScenarioSuggestion[] = [
  {
    id: 'preset-optimistic',
    name: 'Optimistic',
    description: 'Lower uncertainty, higher resource availability',
    params: {
      budget_uncertainty: 0.10,
      schedule_uncertainty: 0.15,
      resource_availability: 0.95,
      iterations: 5000,
      confidence_level: 0.90,
    },
  },
  {
    id: 'preset-realistic',
    name: 'Realistic',
    description: 'Moderate uncertainty and resources',
    params: {
      budget_uncertainty: 0.15,
      schedule_uncertainty: 0.20,
      resource_availability: 0.90,
      iterations: 5000,
      confidence_level: 0.95,
    },
  },
  {
    id: 'preset-conservative',
    name: 'Conservative',
    description: 'Higher uncertainty, lower resource availability',
    params: {
      budget_uncertainty: 0.25,
      schedule_uncertainty: 0.30,
      resource_availability: 0.85,
      iterations: 8000,
      confidence_level: 0.95,
    },
  },
  {
    id: 'preset-worst-case',
    name: 'Worst Case',
    description: 'High uncertainty for stress testing',
    params: {
      budget_uncertainty: 0.35,
      schedule_uncertainty: 0.40,
      resource_availability: 0.80,
      iterations: 10000,
      confidence_level: 0.99,
    },
  },
  {
    id: 'preset-quick',
    name: 'Quick Run',
    description: 'Fewer iterations for fast feedback',
    params: {
      budget_uncertainty: 0.15,
      schedule_uncertainty: 0.20,
      resource_availability: 0.90,
      iterations: 1000,
      confidence_level: 0.90,
    },
  },
]

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }
    return NextResponse.json({ suggestions: FALLBACK_PRESETS })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
